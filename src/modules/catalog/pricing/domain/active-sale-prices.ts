import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';

export interface ActiveSalePrice {
  price: number;
  startsAt: Date;
  endsAt: Date;
}

/** Giá khuyến mãi đang hiệu lực tại `at` của các Biến thể (tối đa một mỗi Biến thể, BR-PRC-02). */
export async function findActiveSalePrices(
  prisma: PrismaService,
  variantIds: string[],
  at: Date,
): Promise<Map<string, ActiveSalePrice>> {
  if (variantIds.length === 0) return new Map();
  const rows = await prisma.salePrice.findMany({
    where: { variantId: { in: variantIds }, startsAt: { lte: at }, endsAt: { gt: at } },
    select: { variantId: true, price: true, startsAt: true, endsAt: true },
  });
  return new Map(rows.map(({ variantId, price, ...rest }) => [variantId, { ...rest, price: Number(price) }]));
}
