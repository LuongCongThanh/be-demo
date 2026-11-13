import type { Prisma, Voucher } from '#src/generated/prisma/client.js';

/** Trạng thái hiển thị của Voucher tại thời điểm `at` (BR-VCH-04). */
export const VOUCHER_STATUSES = ['ACTIVE', 'UPCOMING', 'ENDED', 'EXHAUSTED', 'DISABLED'] as const;
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

type StatusFields = Pick<Voucher, 'isActive' | 'startsAt' | 'endsAt' | 'totalLimit' | 'usedCount'>;

export function voucherStatus(voucher: StatusFields, at: Date): VoucherStatus {
  if (!voucher.isActive) return 'DISABLED';
  if (at >= voucher.endsAt) return 'ENDED';
  if (at < voucher.startsAt) return 'UPCOMING';
  if (voucher.totalLimit !== null && voucher.usedCount >= voucher.totalLimit) return 'EXHAUSTED';
  return 'ACTIVE';
}

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
