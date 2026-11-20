import { ConflictException } from '@nestjs/common';
import { Prisma } from '#src/generated/prisma/client.js';

type Db = Prisma.TransactionClient;

/** Constraint name from migration `20261113180000_sale_prices` (BR-PRC-02). */
const NO_OVERLAP_CONSTRAINT = 'sale_prices_no_overlap';

/** True when Postgres rejected a write because two Giá khuyến mãi of one Biến thể overlap in time. */
export function isSalePriceOverlap(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  let meta = '';
  try {
    meta = JSON.stringify(error.meta, (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value));
  } catch {
    // meta không serialize được: chỉ dựa vào message.
  }
  return `${error.message} ${meta}`.includes(NO_OVERLAP_CONSTRAINT) || meta.includes('23P01');
}

/** Khoá dòng Biến thể trong transaction để kiểm Giá bán và Giá khuyến mãi không chạy đua nhau (BR-PRC-01, BR-PRC-05). */
export async function lockVariants(db: Db, variantIds: string[]): Promise<void> {
  if (variantIds.length === 0) return;
  await db.$queryRaw`SELECT id FROM product_variants WHERE id IN (${Prisma.join(variantIds.map((id) => Prisma.sql`${id}::uuid`))}) FOR UPDATE`;
}

/**
 * BR-PRC-05: Giá bán mới phải lớn hơn mọi Giá khuyến mãi đang hoặc sắp hiệu lực của Biến thể;
 * Admin sửa Giá khuyến mãi trước.
 */
export async function assertPriceAboveSalePrices(db: Db, variantId: string, newPrice: number, at: Date): Promise<void> {
  const blocking = await db.salePrice.findFirst({
    where: { variantId, endsAt: { gt: at }, price: { gte: BigInt(newPrice) } },
    select: { price: true },
  });
  if (blocking) {
    throw new ConflictException(
      `Price must stay above the current or upcoming sale price (${Number(blocking.price)}); change the sale price first`,
    );
  }
}
