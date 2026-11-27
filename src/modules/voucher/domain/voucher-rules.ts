import { InvalidInputError } from '#src/common/errors/business-errors.js';
import type {
  Voucher,
  VoucherChanges,
  VoucherSnapshot,
  VoucherTerms,
} from '#src/modules/voucher/domain/voucher.model.js';

/** Trường còn sửa được khi Voucher đã có lượt dùng. */
export const EDITABLE_AFTER_USE = new Set<keyof VoucherChanges>(['endsAt', 'totalLimit', 'perBuyerLimit', 'isActive']);
/** Trường không nhận `null` (cột NOT NULL). */
export const NOT_NULL = ['type', 'value', 'minSubtotal', 'startsAt', 'endsAt', 'isActive'] as const;

/** BR-VCH-03: % trong 1–100, mức tối đa chỉ cho %; thời gian kết thúc sau bắt đầu. */
export function assertTerms({ type, value, maxDiscount, startsAt, endsAt }: VoucherTerms): void {
  if (type === 'PERCENT' && value > 100) throw new InvalidInputError('A percent voucher value must be 1–100');
  if (type === 'FIXED' && maxDiscount !== null)
    throw new InvalidInputError('maxDiscount applies to percent vouchers only');
  if (endsAt <= startsAt) throw new InvalidInputError('endsAt must be after startsAt');
}

/** Trường thực sự đổi giá trị: form gửi lại cả object không bị coi là sửa trường đã khoá. */
export function changedFields(current: Voucher, changes: VoucherChanges): (keyof VoucherChanges)[] {
  const now: Record<keyof VoucherChanges, unknown> = {
    type: current.type,
    value: current.value,
    maxDiscount: current.maxDiscount,
    minSubtotal: current.minSubtotal,
    totalLimit: current.totalLimit,
    perBuyerLimit: current.perBuyerLimit,
    startsAt: current.startsAt.getTime(),
    endsAt: current.endsAt.getTime(),
    isActive: current.isActive,
  };
  return (Object.keys(changes) as (keyof VoucherChanges)[]).filter((key) => {
    const next = changes[key];
    if (next === undefined) return false;
    return (next instanceof Date ? next.getTime() : next) !== now[key];
  });
}

/** Số tiền phải là số nguyên an toàn của JavaScript (cùng thông báo với checkout). */
export function safeAmount(value: number): number {
  if (!Number.isSafeInteger(value)) throw new InvalidInputError('Checkout amounts exceed the supported numeric range');
  return value;
}

/** Voucher còn áp dụng được cho `subtotal` tại `now` (đang bật, trong thời hạn, đủ tối thiểu, còn lượt). */
export function isApplicable(voucher: Voucher | null, subtotal: number, now: Date): voucher is Voucher {
  return !(
    !voucher ||
    !voucher.isActive ||
    voucher.startsAt > now ||
    voucher.endsAt <= now ||
    subtotal < voucher.minSubtotal ||
    (voucher.totalLimit !== null && voucher.usedCount >= voucher.totalLimit)
  );
}

export function toSnapshot(voucher: Voucher): VoucherSnapshot {
  return {
    id: voucher.id,
    code: voucher.code,
    type: voucher.type,
    value: safeAmount(voucher.value),
    maxDiscount: voucher.maxDiscount === null ? null : safeAmount(voucher.maxDiscount),
    minSubtotal: safeAmount(voucher.minSubtotal),
    totalLimit: voucher.totalLimit,
    perBuyerLimit: voucher.perBuyerLimit,
    usedCount: voucher.usedCount,
    startsAt: voucher.startsAt,
    endsAt: voucher.endsAt,
    isActive: voucher.isActive,
  };
}
