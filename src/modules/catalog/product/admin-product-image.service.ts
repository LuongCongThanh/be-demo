import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ProductImage } from '#src/generated/prisma/client.js';
import { Prisma } from '#src/generated/prisma/client.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';
import { ImageResponseDto } from '#src/modules/catalog/product/dto/image-response.dto.js';
import { PresignImageDto } from '#src/modules/catalog/product/dto/presign-image.dto.js';
import { PresignedImageUploadResponseDto } from '#src/modules/catalog/product/dto/presigned-image-upload-response.dto.js';
import {
  IMAGE_FORMATS,
  IMAGE_MAX_BYTES,
  imageKeyPrefix,
} from '#src/modules/catalog/product/product-image.constants.js';
import { toImageResponse } from '#src/modules/catalog/product/product-image.mapper.js';
import { CreateImageDto } from '#src/modules/catalog/product/dto/create-image.dto.js';
import { UpdateImageDto } from '#src/modules/catalog/product/dto/update-image.dto.js';

/**
 * Ảnh theo màu (BR-CAT-05). Upload hai bước: `presign` ký tham số để CMS up
 * thẳng lên kho ảnh, rồi `create` kiểm file thật trong kho (loại, dung lượng)
 * trước khi ghi metadata. API không nhận byte ảnh.
 * Tối đa một ảnh primary cho mỗi
 * (product, color): đặt primary mới sẽ bỏ cờ ảnh primary cũ trong cùng
 * transaction; partial unique index ở DB là chốt chặn khi chạy đồng thời.
 */
@Injectable()
export class AdminProductImageService {
  private readonly logger = new Logger(AdminProductImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CloudinaryClient,
  ) {}

  /** `contentType`/`size` chỉ là lời khai của client; `create` kiểm lại trên file thật. */
  async presign(productId: string, _dto: PresignImageDto): Promise<PresignedImageUploadResponseDto> {
    await this.assertProduct(productId);
    const storageKey = `${imageKeyPrefix(productId)}${randomUUID()}`;
    return { ...this.storage.signUpload(storageKey, IMAGE_FORMATS), storageKey };
  }

  async create(productId: string, dto: CreateImageDto): Promise<ImageResponseDto> {
    const [, color] = await Promise.all([
      this.assertProduct(productId),
      this.prisma.color.findUnique({ where: { id: dto.colorId }, select: { id: true } }),
    ]);
    if (!color) throw new BadRequestException(`Color #${dto.colorId} does not exist`);
    if (!dto.storageKey.startsWith(imageKeyPrefix(productId))) {
      throw new BadRequestException('storageKey was not issued for this product');
    }
    await this.assertUploaded(dto.storageKey);

    const image = await this.primaryRace(() =>
      this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary) await this.demotePrimary(tx, productId, dto.colorId);
        return tx.productImage.create({ data: { ...dto, productId } });
      }),
    );
    return toImageResponse(image, this.storage);
  }

  async update(productId: string, imageId: string, dto: UpdateImageDto): Promise<ImageResponseDto> {
    const image = await this.findOrThrow(productId, imageId);
    const updated = await this.primaryRace(() =>
      this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary && !image.isPrimary) await this.demotePrimary(tx, productId, image.colorId);
        return tx.productImage.update({ where: { id: imageId }, data: dto });
      }),
    );
    return toImageResponse(updated, this.storage);
  }

  /** Xoá bản ghi trước; xoá file trong kho là best-effort (lỗi chỉ log, file mồ côi dọn sau). */
  async remove(productId: string, imageId: string): Promise<void> {
    const image = await this.findOrThrow(productId, imageId);
    const { count } = await this.prisma.productImage.deleteMany({ where: { id: imageId, productId } });
    if (count === 0) throw new NotFoundException(`Image #${imageId} not found on product #${productId}`);
    await this.storage.destroy(image.storageKey).catch((err: unknown) => {
      this.logger.warn(`Image ${image.storageKey} removed from product but not from storage: ${String(err)}`);
    });
  }

  /** File phải có trong kho, đúng định dạng và không quá 5MB; sai thì xoá file và trả 422. */
  private async assertUploaded(storageKey: string): Promise<void> {
    const stored = await this.storage.findImage(storageKey);
    if (!stored) throw new UnprocessableEntityException('Image was not uploaded to storage');
    const formatOk = (IMAGE_FORMATS as readonly string[]).includes(stored.format);
    if (formatOk && stored.bytes <= IMAGE_MAX_BYTES) return;
    await this.storage.destroy(storageKey).catch(() => undefined);
    throw new UnprocessableEntityException(
      formatOk ? `Image is larger than ${IMAGE_MAX_BYTES} bytes` : `Image format ${stored.format} is not allowed`,
    );
  }

  private async assertProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException(`Product #${productId} not found`);
  }

  /**
   * Hai request cùng đặt primary cho một màu: cả hai demote xong rồi cùng
   * insert/update, request thua chạm partial unique index (P2002) → 409.
   */
  private async primaryRace<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Another primary image was set for this color at the same time — retry');
      }
      throw err;
    }
  }

  private async demotePrimary(tx: Prisma.TransactionClient, productId: string, colorId: string): Promise<void> {
    await tx.productImage.updateMany({ where: { productId, colorId, isPrimary: true }, data: { isPrimary: false } });
  }

  private async findOrThrow(productId: string, imageId: string): Promise<ProductImage> {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) throw new NotFoundException(`Image #${imageId} not found on product #${productId}`);
    return image;
  }
}
