import type { Voucher } from '#src/modules/voucher/domain/voucher.model.js';

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
