import type {
  InventoryLevel,
  NewInventoryMovement,
  NewStockCount,
  StockCount,
  StockCountConfirmation,
  StockLine,
} from '#src/modules/inventory/domain/inventory.model.js';

/** Mọi đọc/ghi `inventory`, `inventory_movements`, `inventory_stock_counts`, `awaiting_dispatch_items`. */
export abstract class InventoryRepository {
  /** Với `lockForUpdate`, khoá dòng theo `variant_id` tăng dần (chỉ có tác dụng trong giao dịch đang mở). */
  abstract findLevels(variantIds: string[], options?: { lockForUpdate?: boolean }): Promise<InventoryLevel[]>;
  abstract setQuantity(variantId: string, quantity: number): Promise<void>;
  /** Trừ `quantity` nếu `tồn >= quantity + reservedQuantity`; trả `false` khi không đủ hàng. */
  abstract decrementIfSufficient(variantId: string, quantity: number, reservedQuantity: number): Promise<boolean>;
  abstract addMovement(movement: NewInventoryMovement): Promise<void>;
  abstract sumAwaitingQuantity(variantId: string): Promise<number>;
  abstract addAwaitingDispatch(orderId: string, lines: StockLine[]): Promise<void>;
  abstract createStockCount(count: NewStockCount): Promise<StockCount>;
  abstract findStockCount(id: string): Promise<StockCount | null>;
  /** Xác nhận phiếu nếu còn `confirmedAt IS NULL`; trả `null` khi phiếu đã được xác nhận trước đó. */
  abstract confirmStockCount(id: string, confirmation: StockCountConfirmation): Promise<StockCount | null>;
}
