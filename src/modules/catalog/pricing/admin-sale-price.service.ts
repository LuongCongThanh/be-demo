import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { SalePrice } from '#src/generated/prisma/client.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CreateSalePriceDto } from '#src/modules/catalog/pricing/dto/create-sale-price.dto.js';
import { SalePriceResponseDto } from '#src/modules/catalog/pricing/dto/sale-price-response.dto.js';
import { UpdateSalePriceDto } from '#src/modules/catalog/pricing/dto/update-sale-price.dto.js';
import { isSalePriceOverlap, lockVariants } from '#src/modules/catalog/pricing/sale-price-guards.js';
import { priceAfterPercentOff, salePriceStatus } from '#src/modules/catalog/pricing/sale-price-status.js';

/** A start this far in the past is treated as "now" (form submit and clock skew), not rejected. */
const START_GRACE_MS = 5 * 60_000;
const OVERLAP_MESSAGE = 'Overlaps another sale price of the same variant (BR-PRC-02)';

/**
 * Giá khuyến mãi (US-804, BR-PRC-01/02/05). Trạng thái tính theo thời điểm request:
 * sắp diễn ra thì sửa/xoá tự do; đang hiệu lực chỉ đổi thời gian kết thúc hoặc kết thúc ngay;
 * đã kết thúc chỉ xem.
 */
@Injectable()
export class AdminSalePriceService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProduct(productId: string): Promise<SalePriceResponseDto[]> {
    await this.assertProduct(productId);
    const rows = await this.prisma.salePrice.findMany({
      where: { variant: { productId } },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
    });
    const now = new Date();
    return rows.map((row) => toResponse(row, now));
  }

  async create(productId: string, dto: CreateSalePriceDto, createdById: string): Promise<SalePriceResponseDto[]> {
    if ((dto.price === undefined) === (dto.percentOff === undefined)) {
      throw new BadRequestException('Send exactly one of price or percentOff');
    }
    await this.assertProduct(productId);
    const now = new Date();
    const startsAt = this.validStart(dto.startsAt ?? now, now);
    this.assertPeriod(startsAt, dto.endsAt);

    const ids = dto.variantIds;
    try {
      // Khoá các Biến thể: Giá bán không đổi giữa lúc kiểm và lúc ghi (BR-PRC-01, BR-PRC-05).
      const created = await this.prisma.$transaction(async (tx) => {
        await lockVariants(tx, ids);
        const variants = await tx.productVariant.findMany({
          where: { id: { in: ids }, productId },
          select: { id: true, sku: true, price: true, status: true },
        });
        if (variants.length !== ids.length) {
          throw new NotFoundException('One or more variants do not belong to this product');
        }
        const archived = variants.filter((v) => v.status !== 'ACTIVE').map((v) => v.sku);
        if (archived.length > 0)
          throw new BadRequestException(`Archived variants cannot go on sale: ${archived.join(', ')}`);

        const planned = variants.map((variant) => {
          const price =
            dto.price === undefined ? priceAfterPercentOff(variant.price, dto.percentOff ?? 0) : BigInt(dto.price);
          if (price <= 0n || price >= variant.price) {
            throw new BadRequestException(
              `Sale price for ${variant.sku} must be above 0 and below its price ${Number(variant.price)}`,
            );
          }
          return { variantId: variant.id, price };
        });

        const overlapping = await tx.salePrice.findMany({
          where: { variantId: { in: ids }, startsAt: { lt: dto.endsAt }, endsAt: { gt: startsAt } },
          select: { variant: { select: { sku: true } } },
        });
        if (overlapping.length > 0) {
          throw new ConflictException(
            `${OVERLAP_MESSAGE}: ${[...new Set(overlapping.map((o) => o.variant.sku))].join(', ')}`,
          );
        }

        return Promise.all(
          planned.map(({ variantId, price }) =>
            tx.salePrice.create({ data: { variantId, price, startsAt, endsAt: dto.endsAt, createdById } }),
          ),
        );
      });
      return created.map((row) => toResponse(row, now));
    } catch (error) {
      if (isSalePriceOverlap(error)) throw new ConflictException(OVERLAP_MESSAGE);
      throw error;
    }
  }

  async update(id: string, dto: UpdateSalePriceDto): Promise<SalePriceResponseDto> {
    const current = await this.findOrThrow(id);
    const now = new Date();
    const status = salePriceStatus(current, now);
    if (status === 'ENDED') throw new ConflictException('An ended sale price cannot change');
    if (status === 'ACTIVE' && (dto.price !== undefined || dto.startsAt !== undefined)) {
      throw new ConflictException('Only the end of an active sale price can change');
    }

    const startsAt = dto.startsAt === undefined ? current.startsAt : this.validStart(dto.startsAt, now);
    const endsAt = dto.endsAt ?? current.endsAt;
    this.assertPeriod(startsAt, endsAt);
    if (endsAt <= now) throw new BadRequestException('endsAt must be in the future; use the end action to stop it now');

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await lockVariants(tx, [current.variantId]);
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: current.variantId },
          select: { price: true },
        });
        // Kiểm lại cả khi chỉ đổi thời gian: Giá bán có thể đã đổi từ lúc tạo.
        const price = dto.price === undefined ? current.price : BigInt(dto.price);
        if (price >= variant.price) {
          throw new BadRequestException(`Sale price must be below the variant price ${Number(variant.price)}`);
        }
        return tx.salePrice.update({ where: { id }, data: { price, startsAt, endsAt } });
      });
      return toResponse(updated, now);
    } catch (error) {
      if (isSalePriceOverlap(error)) throw new ConflictException(OVERLAP_MESSAGE);
      throw error;
    }
  }

  /** Kết thúc ngay một Giá khuyến mãi đang hiệu lực. */
  async end(id: string): Promise<SalePriceResponseDto> {
    const current = await this.findOrThrow(id);
    const now = new Date();
    if (salePriceStatus(current, now) !== 'ACTIVE')
      throw new ConflictException('Only an active sale price can be ended');
    const updated = await this.prisma.salePrice.update({ where: { id }, data: { endsAt: now } });
    return toResponse(updated, now);
  }

  /** Chỉ xoá được Giá khuyến mãi chưa bắt đầu; cái đã bắt đầu là lịch sử. */
  async remove(id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    if (salePriceStatus(current, new Date()) !== 'UPCOMING') {
      throw new ConflictException('Only an upcoming sale price can be deleted');
    }
    await this.prisma.salePrice.delete({ where: { id } });
  }

  private async findOrThrow(id: string) {
    const found = await this.prisma.salePrice.findUnique({
      where: { id },
      include: { variant: { select: { price: true } } },
    });
    if (!found) throw new NotFoundException(`Sale price #${id} not found`);
    return found;
  }

  private async assertProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException(`Product #${productId} not found`);
  }

  private validStart(startsAt: Date, now: Date): Date {
    if (startsAt.getTime() < now.getTime() - START_GRACE_MS)
      throw new BadRequestException('startsAt cannot be in the past');
    return startsAt < now ? now : startsAt;
  }

  private assertPeriod(startsAt: Date, endsAt: Date): void {
    if (endsAt <= startsAt) throw new BadRequestException('endsAt must be after startsAt');
  }
}

function toResponse(row: SalePrice, at: Date): SalePriceResponseDto {
  return {
    id: row.id,
    variantId: row.variantId,
    price: Number(row.price),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: salePriceStatus(row, at),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
