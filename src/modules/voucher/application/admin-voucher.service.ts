import { Injectable } from '@nestjs/common';
import { ConflictError, InvalidInputError, NotFoundError } from '#src/common/errors/business-errors.js';
import type { Paginated } from '#src/common/pagination/paginate.js';
import { TransactionRunner } from '#src/infrastructure/database/transaction-runner.port.js';
import { VoucherRepository } from '#src/modules/voucher/application/ports/voucher.repository.js';
import { voucherStatus } from '#src/modules/voucher/domain/voucher-status.js';
import { EDITABLE_AFTER_USE, NOT_NULL, assertTerms, changedFields } from '#src/modules/voucher/domain/voucher-rules.js';
import type {
  Voucher,
  VoucherChanges,
  VoucherListQuery,
  VoucherTerms,
  VoucherType,
  VoucherWithStatus,
} from '#src/modules/voucher/domain/voucher.model.js';

interface CreateVoucherInput extends Omit<VoucherTerms, 'maxDiscount'> {
  code: string;
  maxDiscount?: number | null;
  minSubtotal?: number;
  totalLimit?: number | null;
  perBuyerLimit?: number | null;
  isActive?: boolean;
}

/**
 * Voucher phía back-office (US-901). Áp mã, đếm và trả lượt dùng nằm ở `VoucherService`.
 * Mã không đổi; Voucher chưa ai dùng sửa và xoá tự do; đã có lượt dùng chỉ đổi thời gian kết thúc,
 * giới hạn lượt và bật/tắt, không xoá được.
 */
@Injectable()
export class AdminVoucherService {
  constructor(
    private readonly vouchers: VoucherRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async findAll(query: VoucherListQuery): Promise<Paginated<VoucherWithStatus>> {
    const now = new Date();
    const result = await this.vouchers.findPage(query, now);
    return { ...result, data: result.data.map((v) => withStatus(v, now)) };
  }

  async findOne(id: string): Promise<VoucherWithStatus> {
    return withStatus(await this.findOrThrow(id), new Date());
  }

  async create(input: CreateVoucherInput, createdById: string): Promise<VoucherWithStatus> {
    const { type, value, startsAt, endsAt } = input;
    const maxDiscount = input.maxDiscount ?? null;
    assertTerms({ type, value, maxDiscount, startsAt, endsAt });
    const created = await this.vouchers.create({
      code: input.code,
      type,
      value,
      maxDiscount,
      minSubtotal: input.minSubtotal ?? 0,
      totalLimit: input.totalLimit ?? null,
      perBuyerLimit: input.perBuyerLimit ?? null,
      startsAt,
      endsAt,
      isActive: input.isActive ?? true,
      createdById,
    });
    if (!created) throw new ConflictError(`Voucher code "${input.code}" already exists`);
    return withStatus(created, new Date());
  }

  async update(id: string, changes: VoucherChanges): Promise<VoucherWithStatus> {
    for (const key of NOT_NULL) {
      if (changes[key] === null) throw new InvalidInputError(`${key} cannot be null`);
    }
    // Khoá dòng: lượt dùng (slice C) không được đổi giữa lúc kiểm và lúc ghi.
    const updated = await this.transactionRunner.run(async () => {
      const current = await this.lockOrThrow(id);
      const changed = changedFields(current, changes);
      if (changed.length === 0) return current;
      if (current.usedCount > 0) {
        const locked = changed.filter((key) => !EDITABLE_AFTER_USE.has(key));
        if (locked.length > 0) {
          throw new ConflictError(`Voucher already used; these cannot change: ${locked.join(', ')}`);
        }
      }

      const type: VoucherType = changes.type ?? current.type;
      // Đổi sang FIXED mà không gửi maxDiscount: bỏ mức tối đa (chỉ áp cho %).
      const maxDiscount =
        changes.maxDiscount !== undefined ? changes.maxDiscount : type === 'FIXED' ? null : current.maxDiscount;
      assertTerms({
        type,
        value: changes.value ?? current.value,
        maxDiscount,
        startsAt: changes.startsAt ?? current.startsAt,
        endsAt: changes.endsAt ?? current.endsAt,
      });

      const totalLimit = changes.totalLimit === undefined ? current.totalLimit : changes.totalLimit;
      if (totalLimit !== null && totalLimit < current.usedCount) {
        throw new InvalidInputError(`totalLimit cannot be below the ${current.usedCount} uses already counted`);
      }
      return this.vouchers.update(id, { ...changes, maxDiscount });
    });
    return withStatus(updated, new Date());
  }

  /** Chỉ xoá Voucher chưa có lượt dùng; đã dùng thì vô hiệu hoá (BR-VCH-11). */
  async remove(id: string): Promise<void> {
    await this.transactionRunner.run(async () => {
      const current = await this.lockOrThrow(id);
      if (current.usedCount > 0) throw new ConflictError('Voucher already used; deactivate it instead');
      await this.vouchers.delete(id);
    });
  }

  private async findOrThrow(id: string): Promise<Voucher> {
    const found = await this.vouchers.findById(id);
    if (!found) throw new NotFoundError(`Voucher #${id} not found`);
    return found;
  }

  /** Đọc Voucher và khoá dòng tới hết giao dịch; không có → 404. */
  private async lockOrThrow(id: string): Promise<Voucher> {
    const found = await this.vouchers.lockById(id);
    if (!found) throw new NotFoundError(`Voucher #${id} not found`);
    return found;
  }
}

function withStatus(voucher: Voucher, at: Date): VoucherWithStatus {
  return { ...voucher, status: voucherStatus(voucher, at) };
}
