import { Injectable } from '@nestjs/common';
import { ConflictError, InvalidInputError } from '#src/common/errors/business-errors.js';
import { TransactionRunner } from '#src/infrastructure/database/transaction-runner.port.js';
import { InventoryRepository } from '#src/modules/inventory/application/ports/inventory.repository.js';
import type { StockLine } from '#src/modules/inventory/domain/inventory.model.js';

export interface VariantAvailability {
  variantId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

/** Class công khai duy nhất của `InventoryModule`: chỉ chứa hàm module khác cần. */
@Injectable()
export class InventoryService {
  constructor(
    private readonly inventory: InventoryRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  /**
   * Trả một phần tử cho mỗi variant, theo thứ tự `variantIds`.
   * - Variant chưa có dòng `inventory` trả `quantity`/`reservedQuantity`/`availableQuantity` = 0/0/0.
   * - `availableQuantity = max(0, quantity - reservedQuantity)` (không bao giờ âm).
   * - `lockForUpdate` chỉ dùng trong `TransactionRunner.run()`; ngoài giao dịch sẽ ném lỗi (lỗi lập trình).
   *   Các dòng được khoá theo `variant_id` tăng dần để tránh deadlock.
   */
  async getAvailability(variantIds: string[], options?: { lockForUpdate?: boolean }): Promise<VariantAvailability[]> {
    const levels = await this.inventory.findLevels(variantIds, options);
    const byVariant = new Map(levels.map((level) => [level.variantId, level]));
    return variantIds.map((variantId) => {
      const quantity = byVariant.get(variantId)?.quantity ?? 0;
      const reservedQuantity = byVariant.get(variantId)?.reservedQuantity ?? 0;
      return { variantId, quantity, reservedQuantity, availableQuantity: Math.max(0, quantity - reservedQuantity) };
    });
  }

  /**
   * Trừ tồn có điều kiện đủ hàng rồi ghi hàng chờ xuất của đơn, trong một giao dịch.
   * Khoá các dòng theo `variant_id` tăng dần. Thiếu hàng ném `ConflictError`; `quantity` không phải
   * số nguyên dương hoặc `variantId` trùng trong `lines` ném `InvalidInputError`.
   */
  async commitStockForOrder(orderId: string, lines: StockLine[]): Promise<void> {
    const seen = new Set<string>();
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new InvalidInputError(`Quantity must be a positive integer for variant ${line.variantId}`);
      }
      if (seen.has(line.variantId)) throw new InvalidInputError(`Duplicate variant ${line.variantId} in lines`);
      seen.add(line.variantId);
    }
    await this.transactionRunner.run(async () => {
      const levels = await this.inventory.findLevels(
        lines.map((line) => line.variantId),
        { lockForUpdate: true },
      );
      const reserved = new Map(levels.map((level) => [level.variantId, level.reservedQuantity]));
      for (const line of lines) {
        const done = await this.inventory.decrementIfSufficient(
          line.variantId,
          line.quantity,
          reserved.get(line.variantId) ?? 0,
        );
        if (!done) throw new ConflictError(`Insufficient stock for variant ${line.variantId}`);
      }
      await this.inventory.addAwaitingDispatch(orderId, lines);
    });
  }
}
