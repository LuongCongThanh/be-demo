# Module `inventory`

> Trạng thái: **Bản nháp cho tái cấu trúc** ([quy ước](../../README.md#trạng-thái-tài-liệu)). Bảng: [`../11-database.md`](../11-database.md). Ranh giới: [`../02-modules.md`](../02-modules.md). Nguồn nghiệp vụ: [business/04](../../business/04-business-rules.md) §3 (BR-INV-*), [business/03](../../business/03-user-stories.md) E7. Nhất quán: [../04-data-consistency.md](../04-data-consistency.md).

## 1. Trách nhiệm

- Sở hữu: Tồn kho theo Biến thể × Kho, Giữ hàng, Hàng chờ xuất, sổ biến động, Kiểm kê.
- Công thức: Số lượng bán được = Tồn kho − tổng Giữ hàng còn hiệu lực, không âm (BR-INV-02); Hàng trên kệ = Tồn kho + Hàng chờ xuất ([ADR 0010](../../adr/0010-stock-decremented-at-order-awaiting-dispatch.md)).

## 2. Mô hình

Chi tiết cột, ràng buộc, enum: [`../11-database.md` §4.5](../11-database.md#45-inventory).

- `warehouses` — Kho (MVP một Kho)
- `inventory_levels` — Tồn kho và Giữ hàng theo Biến thể × Kho
- `inventory_reservations` — Giữ hàng 15 phút của đơn online
- `awaiting_dispatch_items` — Hàng chờ xuất theo đơn
- `inventory_movements` — sổ biến động tồn kho, chỉ thêm
- `stock_counts` — phiếu Kiểm kê

## 3. Interface cho module khác

Hàm không nhận `tx`: module gọi bọc lời gọi trong `TransactionRunner.run()` (có từ task 39) và adapter của `inventory` tự nhập vào giao dịch đang mở; khoá `inventory_levels` theo `variant_id` tăng dần.

| Hàm                                           | Gọi ở                                                                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `getSellable(variantIds)`                     | `catalog`, `cart`, `ordering` (Tính thử)                                                                               |
| `reserve(orderId, lines)`                     | T1 (online) — thiếu → lỗi kèm số còn (BR-INV-06)                                                                       |
| `decrementToAwaitingDispatch(orderId, lines)` | T2 (COD, BR-INV-04)                                                                                                    |
| `consumeReservation(orderId)`                 | T3 — `on_hand -= q`, `reserved -= q`, tạo Hàng chờ xuất; Giữ hàng đã quá hạn thì giữ lại nếu còn đủ (business/05 §4.1) |
| `releaseReservation(orderId)`                 | T4, T5                                                                                                                 |
| `returnAwaitingDispatch(orderId)`             | T7, T9 (BR-INV-07)                                                                                                     |
| `clearAwaitingDispatch(orderId)`              | T10                                                                                                                    |
| `restockReturned(orderId                      | returnId, lines)`                                                                                                      | Staff xác nhận hàng về Kho (BR-INV-08): theo `orderId` (Hoàn hàng T12) → movement `return_to_sender`; theo `returnId` (Đổi trả, gọi khi Staff `decide`, không phải khi `receive`) → movement `return_restock` |

### 3.1. Đã triển khai (task 41)

`InventoryModule` export duy nhất `InventoryService` (`src/modules/inventory/application/inventory.service.ts`), hiện gồm:

| Hàm                                               | Ý nghĩa                                                                                                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getAvailability(variantIds, { lockForUpdate? })` | Mỗi variant: `quantity`, `reservedQuantity`, `availableQuantity` (không âm); variant chưa có dòng tồn kho tính 0. `lockForUpdate` khoá dòng `inventory` theo `variant_id` tăng dần, chỉ có tác dụng trong `TransactionRunner.run()` |
| `commitStockForOrder(orderId, lines)`             | Trừ tồn có điều kiện đủ hàng (`quantity >= số lượng + giữ hàng`) và tạo `awaiting_dispatch_items`; thiếu hàng ném `ConflictError` `Insufficient stock for variant <id>`                                                             |

Các hàm còn lại trong bảng trên chưa có. Checkout, cart và product chưa gọi hai hàm này (task 44-46).

## 4. API

| Method | Path                                           | Actor | Ghi chú                                                                                                   |
| ------ | ---------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| `GET`  | `/admin/inventory`                             | staff | Theo Biến thể: Tồn kho, Giữ hàng, Hàng chờ xuất, Số lượng bán được; lọc dưới ngưỡng (mặc định 5) (US-702) |
| `POST` | `/admin/inventory/receipts`                    | staff | Nhập kho (US-701)                                                                                         |
| `POST` | `/admin/inventory/adjustments`                 | staff | Lý do bắt buộc; giảm ≤ Số lượng bán được (BR-INV-11)                                                      |
| `POST` | `/admin/inventory/stock-counts` (+ `/preview`) | staff | Kiểm kê (US-703)                                                                                          |
| `GET`  | `/admin/inventory/:variantId/movements`        | staff | Lịch sử                                                                                                   |

### 4.1. Cấu trúc source

`src/modules/inventory/`: `inventory.module.ts`; `domain/inventory.model.ts` (type thuần); `application/` (`admin-inventory.service.ts` cho Back-office, không export; `inventory.service.ts` công khai; `ports/inventory.repository.ts` là `abstract class` cho `inventory`, `inventory_movements`, `inventory_stock_counts`, `awaiting_dispatch_items`); `infrastructure/prisma-inventory.repository.ts` (dùng `TransactionHost`, chứa khoá `FOR UPDATE`); `admin/controllers/inventory.controller.ts` (`/admin/inventory`) và `admin/dto/inventory.dto.ts`. Giao dịch mở bằng `TransactionRunner.run()`, lỗi ném `NotFoundError`/`ConflictError`.

## 5. Luồng

### 5.1. Kiểm kê (BR-INV-12)

Mỗi thay đổi Tồn kho ghi một dòng `inventory_movements` với `type` ∈ `receipt`/`adjustment`/`stock_count`/`sale`/`cancel_restock`/`return_restock`/`return_to_sender`.

Preview không khoá. Xác nhận: khoá dòng `inventory_levels` → chênh lệch = số đếm − (`on_hand` + Hàng chờ xuất của Biến thể) tính **lúc xác nhận** → nếu giảm vượt Số lượng bán được thì `422` kèm số tối đa → cập nhật `on_hand`, ghi `stock_counts` và movement `stock_count`.

```mermaid
stateDiagram-v2
    [*] --> active: T1 reserve
    active --> converted: T3 thanh toán
    active --> released: T5 Người mua huỷ
    active --> expired: T4 hết 15 phút
    expired --> converted: tiền về muộn, còn đủ hàng (business/05 §4.1)
```

## 6. Sự kiện

Không phát; mọi thay đổi được gọi đồng bộ trong `TransactionRunner.run()` của module điều phối.

## 7. Job

Hết hạn Giữ hàng chạy trong job huỷ đơn của `ordering` ([ordering.md](./ordering.md) §8), không có job riêng.

## 8. Bao phủ

BR-INV-01–12; US-701–703; ADR 0003, ADR 0010.

## 9. Câu hỏi mở

- Danh sách lý do điều chỉnh cố định hay Staff nhập tự do? Business chỉ ví dụ (kiểm kê, hàng lỗi, hàng mẫu) — schema lưu `inventory_movements.reason` dạng text tự do; nếu cần danh sách cố định thì validate ở DTO.
