import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ProductImage } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OBJECT_STORAGE_SERVICE } from './object-storage/object-storage.service.js';
import type { ObjectStorageService, PresignedUploadTarget } from './object-storage/object-storage.service.js';
import { PresignImagesDto } from './dto/presign-images.dto.js';
import { AttachImageDto } from './dto/attach-image.dto.js';

interface BatchImageEntry {
  key: string;
  altText?: string;
  isPrimary?: boolean;
}

@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger(ProductImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE_SERVICE) private readonly storage: ObjectStorageService,
  ) {}

  async presign(dto: PresignImagesDto): Promise<PresignedUploadTarget[]> {
    return this.storage.presignBatch(dto.files);
  }

  // Dùng bởi ProductsService.create() khi tạo product kèm `images[]` — không
  // ai đánh dấu primary → phần tử đầu tự động primary; ≥2 phần tử cùng đánh
  // dấu primary → 400 (xem docs/superpowers/specs
  // 2026-09-18-product-images-object-storage-design.md).
  resolveBatchPrimary(entries: BatchImageEntry[]): (BatchImageEntry & { isPrimary: boolean })[] {
    const primaryCount = entries.filter((e) => e.isPrimary).length;
    if (primaryCount > 1) {
      throw new BadRequestException('Only one image can be marked as primary');
    }
    const hasExplicitPrimary = primaryCount === 1;
    return entries.map((entry, index) => ({
      ...entry,
      isPrimary: hasExplicitPrimary ? Boolean(entry.isPrimary) : index === 0,
    }));
  }

  async attachImage(productId: string, dto: AttachImageDto): Promise<ProductImage> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product #${productId} not found`);
    }

    const url = this.storage.publicUrl(dto.key);
    // Ảnh đầu tiên của product tự động primary; ảnh sau đó mặc định false trừ
    // khi client tự đánh dấu — giữ nguyên hành vi đã chốt cho endpoint attach
    // đơn lẻ (khác batch resolveBatchPrimary() ở trên).
    const isFirstImage = (await this.prisma.productImage.count({ where: { productId } })) === 0;
    const isPrimary = dto.isPrimary ?? isFirstImage;

    if (!isPrimary) {
      return this.prisma.productImage.create({
        data: { productId, url, altText: dto.altText, isPrimary: false },
      });
    }

    // Set primary bắt buộc atomic: unset ảnh primary cũ + tạo ảnh mới với
    // isPrimary=true, tránh khoảnh khắc 2 ảnh cùng primary (partial unique
    // index `product_images_product_id_primary_unique`).
    return this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } });
      return tx.productImage.create({ data: { productId, url, altText: dto.altText, isPrimary: true } });
    });
  }

  async listImages(productId: string): Promise<ProductImage[]> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product #${productId} not found`);
    }

    return this.prisma.productImage.findMany({ where: { productId } });
  }

  async setPrimary(productId: string, imageId: string): Promise<ProductImage> {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) {
      throw new NotFoundException(`Image #${imageId} not found on product #${productId}`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } });
      return tx.productImage.update({ where: { id: imageId }, data: { isPrimary: true } });
    });
  }

  async removeImage(productId: string, imageId: string): Promise<void> {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) {
      throw new NotFoundException(`Image #${imageId} not found on product #${productId}`);
    }

    // Xoá DB trước, storage sau (best-effort) — ảnh biến mất khỏi product là
    // điều user quan tâm ngay lập tức; object rác trên storage không ảnh
    // hưởng nghiệp vụ, dọn sau bằng job riêng (ngoài phạm vi ticket này).
    await this.prisma.productImage.delete({ where: { id: imageId } });
    try {
      await this.storage.delete(this.storage.keyFromUrl(image.url));
    } catch (err) {
      this.logger.error(
        `Failed to delete storage object for image #${imageId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
