import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProductImage } from '#src/generated/prisma/client.js';
import { Prisma } from '#src/generated/prisma/client.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CreateImageDto } from '#src/modules/catalog/dto/products/create-image.dto.js';
import { UpdateImageDto } from '#src/modules/catalog/dto/products/update-image.dto.js';

/**
 * Metadata ảnh theo màu (BR-CAT-05). Tối đa một ảnh primary cho mỗi
 * (product, color): đặt primary mới sẽ bỏ cờ ảnh primary cũ trong cùng
 * transaction; partial unique index ở DB là chốt chặn khi chạy đồng thời.
 */
@Injectable()
export class AdminProductImagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(productId: string, dto: CreateImageDto): Promise<ProductImage> {
    const [product, color] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } }),
      this.prisma.color.findUnique({ where: { id: dto.colorId }, select: { id: true } }),
    ]);
    if (!product) throw new NotFoundException(`Product #${productId} not found`);
    if (!color) throw new BadRequestException(`Color #${dto.colorId} does not exist`);

    return this.primaryRace(() =>
      this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary) await this.demotePrimary(tx, productId, dto.colorId);
        return tx.productImage.create({ data: { ...dto, productId } });
      }),
    );
  }

  async update(productId: string, imageId: string, dto: UpdateImageDto): Promise<ProductImage> {
    const image = await this.findOrThrow(productId, imageId);
    return this.primaryRace(() =>
      this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary && !image.isPrimary) await this.demotePrimary(tx, productId, image.colorId);
        return tx.productImage.update({ where: { id: imageId }, data: dto });
      }),
    );
  }

  async remove(productId: string, imageId: string): Promise<void> {
    // where theo cả productId: không xoá nhầm ảnh của sản phẩm khác, không cần đọc trước.
    const { count } = await this.prisma.productImage.deleteMany({ where: { id: imageId, productId } });
    if (count === 0) throw new NotFoundException(`Image #${imageId} not found on product #${productId}`);
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
