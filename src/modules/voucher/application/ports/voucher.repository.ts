import type { Paginated } from '#src/common/pagination/paginate.js';
import type {
  NewVoucher,
  Voucher,
  VoucherBuyer,
  VoucherChanges,
  VoucherListQuery,
} from '#src/modules/voucher/domain/voucher.model.js';

/** Mọi đọc/ghi bảng `vouchers` và `voucher_usages`. */
export abstract class VoucherRepository {
  /** Mới nhất trước; lọc theo mã chứa `q` và trạng thái tại `now`. */
  abstract findPage(query: VoucherListQuery, now: Date): Promise<Paginated<Voucher>>;
  abstract findById(id: string): Promise<Voucher | null>;
  /**
   * Với `lockForUpdate`, khoá dòng `vouchers` theo `code` trước khi đọc (chỉ dùng trong
   * `TransactionRunner.run()`; ngoài giao dịch sẽ ném lỗi lập trình).
   */
  abstract findByCode(code: string, options?: { lockForUpdate?: boolean }): Promise<Voucher | null>;
  /** Khoá dòng theo `id` tới hết giao dịch rồi đọc; `null` khi không có. */
  abstract lockById(id: string): Promise<Voucher | null>;
  /** `null` khi mã đã tồn tại. */
  abstract create(voucher: NewVoucher): Promise<Voucher | null>;
  abstract update(id: string, changes: VoucherChanges): Promise<Voucher>;
  abstract delete(id: string): Promise<void>;
  /** Số lượt dùng của người mua (khớp theo số điện thoại hoặc tài khoản). */
  abstract countUsages(voucherId: string, buyer: VoucherBuyer): Promise<number>;
  abstract incrementUsedCount(voucherId: string): Promise<void>;
  abstract addUsage(usage: {
    voucherId: string;
    orderId: string;
    buyer: VoucherBuyer;
    discount: number;
  }): Promise<void>;
}
