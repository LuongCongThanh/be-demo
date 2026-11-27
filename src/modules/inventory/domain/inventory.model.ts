/** Tồn kho của một biến thể. */
export interface InventoryLevel {
  variantId: string;
  quantity: number;
  reservedQuantity: number;
}

/** Phiếu kiểm kê; `confirmedAt` là `null` khi chưa xác nhận. */
export interface StockCount {
  id: string;
  variantId: string;
  actorUserId: string;
  physicalCount: number;
  onShelfAtCount: number;
  awaitingAtCount: number;
  discrepancy: number;
  confirmedAt: Date | null;
  createdAt: Date;
}

export interface NewStockCount {
  variantId: string;
  actorUserId: string;
  physicalCount: number;
  onShelfAtCount: number;
  awaitingAtCount: number;
  discrepancy: number;
}

export interface StockCountConfirmation {
  onShelfAtCount: number;
  awaitingAtCount: number;
  discrepancy: number;
  confirmedAt: Date;
}

/** Một dòng sổ biến động tồn kho (chỉ thêm). */
export interface NewInventoryMovement {
  variantId: string;
  actorUserId: string;
  reason: string;
  quantityDelta: number;
  beforeQuantity: number;
  afterQuantity: number;
  beforeReserved: number;
  afterReserved: number;
}

/** Dòng hàng cần trừ tồn và đưa vào hàng chờ xuất. */
export interface StockLine {
  variantId: string;
  quantity: number;
}
