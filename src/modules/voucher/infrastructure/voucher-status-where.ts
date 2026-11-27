import type { Prisma } from '#src/generated/prisma/client.js';
import type { VoucherStatus } from '#src/modules/voucher/domain/voucher-status.js';

/** Điều kiện `where` cho từng trạng thái, khớp với `voucherStatus`. */
export function voucherStatusWhere(
  status: VoucherStatus,
  at: Date,
  totalLimitField: Prisma.FieldRef<'Voucher', 'Int'>,
): Prisma.VoucherWhereInput {
  const live: Prisma.VoucherWhereInput = { isActive: true, startsAt: { lte: at }, endsAt: { gt: at } };
  switch (status) {
    case 'DISABLED':
      return { isActive: false };
    case 'ENDED':
      return { isActive: true, endsAt: { lte: at } };
    case 'UPCOMING':
      return { isActive: true, startsAt: { gt: at } };
    case 'EXHAUSTED':
      return { ...live, totalLimit: { not: null }, usedCount: { gte: totalLimitField } };
    case 'ACTIVE':
      return { ...live, OR: [{ totalLimit: null }, { usedCount: { lt: totalLimitField } }] };
  }
}
