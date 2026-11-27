import { Injectable } from '@nestjs/common';
import { ConflictError } from '#src/common/errors/business-errors.js';
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
   * Trả một phần tử cho mỗi variant, theo thứ tự `variantIds`; variant chưa có dòng tồn kho tính là 0.
   * `lockForUpdate` khoá dòng theo `variant_id` tăng dần và chỉ có tác dụng trong `TransactionRunner.run()`.
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

  /** Trừ tồn có điều kiện đủ hàng rồi ghi hàng chờ xuất của đơn; thiếu hàng ném `ConflictError`. */
  async commitStockForOrder(orderId: string, lines: StockLine[]): Promise<void> {
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
