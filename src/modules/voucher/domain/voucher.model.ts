import type { VoucherStatus } from '#src/modules/voucher/domain/voucher-status.js';

/** Loại giảm giá: `PERCENT` theo %, `FIXED` theo số tiền VND. */
export const VoucherType = { PERCENT: 'PERCENT', FIXED: 'FIXED' } as const;
export type VoucherType = (typeof VoucherType)[keyof typeof VoucherType];

/** Voucher; tiền (VND) là số nguyên `number`. */
export interface Voucher {
  id: string;
  code: string;
  type: VoucherType;
  value: number;
  maxDiscount: number | null;
  minSubtotal: number;
  totalLimit: number | null;
  perBuyerLimit: number | null;
  usedCount: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Voucher kèm trạng thái tại thời điểm xem. */
export type VoucherWithStatus = Voucher & { status: VoucherStatus };

/** Điều khoản cần kiểm chéo khi tạo/sửa Voucher. */
export interface VoucherTerms {
  type: VoucherType;
  value: number;
  maxDiscount: number | null;
  startsAt: Date;
  endsAt: Date;
}

export interface NewVoucher {
  code: string;
  type: VoucherType;
  value: number;
  maxDiscount: number | null;
  minSubtotal: number;
  totalLimit: number | null;
  perBuyerLimit: number | null;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  createdById: string;
}

/** Trường được sửa; `undefined` = giữ nguyên. Chỉ `maxDiscount`, `totalLimit`, `perBuyerLimit` nhận `null` hợp lệ. */
export interface VoucherChanges {
  type?: VoucherType | null;
  value?: number | null;
  maxDiscount?: number | null;
  minSubtotal?: number | null;
  totalLimit?: number | null;
  perBuyerLimit?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive?: boolean | null;
}

export interface VoucherListQuery {
  page: number;
  limit: number;
  q?: string;
  status?: VoucherStatus;
}

/** Người mua: theo tài khoản (`userId`) hoặc số điện thoại. */
export interface VoucherBuyer {
  userId?: string;
  phone: string;
}

/** Voucher đã kiểm điều kiện áp dụng, dùng để tính giảm giá khi đặt đơn. */
export type VoucherSnapshot = Omit<Voucher, 'createdAt' | 'updatedAt'>;
