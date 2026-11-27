import { Injectable } from '@nestjs/common';
import { ConflictError, InvalidInputError } from '#src/common/errors/business-errors.js';
import { VoucherRepository } from '#src/modules/voucher/application/ports/voucher.repository.js';
import { isApplicable, toSnapshot } from '#src/modules/voucher/domain/voucher-rules.js';
import type { VoucherBuyer, VoucherSnapshot } from '#src/modules/voucher/domain/voucher.model.js';

/** Class công khai duy nhất của `VoucherModule`: chỉ chứa hàm module khác cần. */
@Injectable()
export class VoucherService {
  constructor(private readonly vouchers: VoucherRepository) {}

  /**
   * Kiểm Voucher `code` áp dụng được cho `buyer` với `subtotal` (VND) tại `options.now` (mặc định
   * bây giờ) rồi trả snapshot. Điều kiện: đang bật, trong thời hạn, `subtotal` đủ `minSubtotal`, chưa hết
   * `totalLimit`, và người mua (theo số điện thoại hoặc tài khoản) chưa hết `perBuyerLimit`.
   * Không đạt ném `InvalidInputError` (checkout tự đổi loại lỗi theo bước):
   * `Voucher "<code>" is unavailable or does not meet its conditions` hoặc
   * `Voucher "<code>" has reached this buyer's usage limit`.
   * `lockForUpdate` khoá dòng Voucher theo `code`; chỉ dùng trong `TransactionRunner.run()`,
   * ngoài giao dịch sẽ ném lỗi (lỗi lập trình).
   */
  async evaluate(
    code: string,
    buyer: VoucherBuyer,
    subtotal: number,
    options?: { lockForUpdate?: boolean; now?: Date },
  ): Promise<VoucherSnapshot> {
    const voucher = await this.vouchers.findByCode(code, { lockForUpdate: options?.lockForUpdate });
    if (!voucher || !isApplicable(voucher, subtotal, options?.now ?? new Date())) {
      throw new InvalidInputError(`Voucher "${code}" is unavailable or does not meet its conditions`);
    }
    if (voucher.perBuyerLimit !== null) {
      const usageCount = await this.vouchers.countUsages(voucher.id, buyer);
      if (usageCount >= voucher.perBuyerLimit) {
        throw new InvalidInputError(`Voucher "${code}" has reached this buyer's usage limit`);
      }
    }
    return toSnapshot(voucher);
  }

  /**
   * Ghi một lượt dùng: tăng `usedCount` và tạo `voucher_usages`. Gọi trong cùng giao dịch tạo đơn
   * sau khi `evaluate(..., { lockForUpdate: true })` để hai việc không lệch nhau; không khoá thì
   * `evaluate` và `recordUsage` có thể lệch nhau dưới tải song song.
   * Tăng `usedCount` có điều kiện (còn dưới `totalLimit`): Voucher đã hết lượt thì ném `ConflictError`
   * `Voucher "<code>" is unavailable or does not meet its conditions` và không tạo lượt dùng.
   */
  async recordUsage(voucherId: string, orderId: string, buyer: VoucherBuyer, discount: number): Promise<void> {
    if (!(await this.vouchers.incrementUsedCount(voucherId))) {
      const voucher = await this.vouchers.findById(voucherId);
      throw new ConflictError(`Voucher "${voucher?.code ?? voucherId}" is unavailable or does not meet its conditions`);
    }
    await this.vouchers.addUsage({ voucherId, orderId, buyer, discount });
  }
}
