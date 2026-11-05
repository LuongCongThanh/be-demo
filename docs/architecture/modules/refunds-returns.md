# Module `refunds-returns`

> Trạng thái: **Đã chốt cho MVP**. Nguồn nghiệp vụ: [`../../business/04-business-rules.md`](../../business/04-business-rules.md) §8–9, [`../../business/05-order-lifecycle.md`](../../business/05-order-lifecycle.md) §4.4. Quyết định: [ADR 0006](../../adr/0006-manual-refund-mvp-scope.md), [ADR 0012](../../adr/0012-order-line-snapshot-and-voucher-allocation.md).

## 1. Trách nhiệm

- Sở hữu: yêu cầu Hoàn tiền và việc ghi nhận Hoàn tiền thủ công; yêu cầu Đổi trả và các dòng Đổi trả.
- Tính số tiền hoàn: toàn bộ (huỷ/Hoàn hàng), đúng số đã nhận (BR-PAY-04/05), hoặc lũy kế theo dòng khi Đổi trả (BR-RET-07).
- Đảm bảo một thao tác chỉ tạo một yêu cầu cho mỗi Thanh toán và tổng hoàn không vượt số thực nhận (BR-REF-06).
- Không sở hữu: Thanh toán (`payments`), trạng thái Đơn (`ordering` — Đổi trả **không** đổi `orders.status`), Tồn kho (`inventory` — chỉ gọi `restock`).

## 2. Mô hình

| Bảng | Ghi chú |
|---|---|
| `refunds` | `payment_id?` (online) hoặc `cod_collection_id?` (COD Đổi trả — chuyển khoản, BR-REF-04), `order_id`, `return_id?`, `reason` (`ORDER_CANCELLED`, `RETURNED_TO_SENDER`, `RETURN_ACCEPTED`, `AMOUNT_MISMATCH`, `UNEXPECTED_PAYMENT`), `amount`, `status` (`REQUESTED → REFUNDED`), `operation_key` unique (định danh thao tác ổn định — BR-REF-06), `refund_transaction_ref`, `refunded_at`, `recorded_by` |
| `returns` | `order_id`, `status` (`RECORDED → RECEIVED → ACCEPTED \| REJECTED → REFUNDED`), kênh tiếp nhận (hotline/Zalo — BR-RET-04), ai chịu phí ship trả (BR-RET-06), ghi chú gửi lại hàng (BR-RET-09), `recorded_at` |
| `return_items` | `return_id`, `order_item_id`, `quantity_returned`, `quantity_accepted`, `restock` (bool), `refund_amount` (số hoàn của dòng trong lần này) |

"Đang mở" = `returns.status NOT IN (REJECTED, REFUNDED)`.

## 3. Interface public

| Hàm | Gọi bởi | Ghi chú |
|---|---|---|
| `requestFullRefund(tx, orderId, reason)` | `ordering` (T7, T9, T12, T14) | Chỉ khi đơn online đã có Thanh toán captured; số tiền = Tổng tiền đơn (BR-REF-05) |
| `requestRefund(tx, paymentId, amount, reason, operationKey)` | `payments` (BR-PAY-04/05) | Đúng số tiền đã nhận |
| `hasOpen(orderId)` | `ordering` (guard T13) | |

Ràng buộc tổng (BR-REF-06) kiểm tra trong transaction có khoá dòng `payments` (hoặc `cod_collections`): `SUM(refunds.amount WHERE status IN (REQUESTED, REFUNDED)) + amount <= captured_amount`; `operation_key` unique làm việc xử lý lại idempotent ([`../04-data-consistency.md`](../04-data-consistency.md)).

## 4. API

| Method | Path | Actor | Ghi chú |
|---|---|---|---|
| `GET` | `/admin/refunds?status=REQUESTED&reason=` | staff | Danh sách chờ xử lý, gồm yêu cầu tự tạo (US-608) |
| `POST` | `/admin/refunds/:id/record` | staff | `{ refundTransactionRef, refundedAt }` → `REFUNDED` (US-605, BR-REF-03) |
| `POST` | `/admin/orders/:id/returns` | staff | Ghi nhận Đổi trả: dòng + số lượng gửi trả. Từ chối nếu quá 7×24h từ `delivered_at` (BR-RET-01) hoặc dòng có Giá khuyến mãi giảm > 50% (BR-RET-03) |
| `POST` | `/admin/returns/:id/receive` | staff | `RECEIVED`; chưa cộng Tồn kho |
| `POST` | `/admin/returns/:id/decide` | staff | Theo từng dòng: `quantityAccepted`, `restock` (BR-RET-08) |
| `PATCH` | `/admin/returns/:id/notes` | staff | Ghi chú gửi lại hàng (BR-RET-09) |

## 5. Luồng

### 5.1. Đổi trả

```mermaid
stateDiagram-v2
    [*] --> RECORDED: Staff ghi nhận (trong 7 ngày)
    RECORDED --> RECEIVED: Hàng về Kho
    RECEIVED --> REJECTED: Không dòng nào được chấp nhận
    RECEIVED --> ACCEPTED: ≥ 1 sản phẩm được chấp nhận, số hoàn > 0
    RECEIVED --> REFUNDED: Được chấp nhận, số hoàn = 0
    ACCEPTED --> REFUNDED: Staff ghi nhận Hoàn tiền
    REJECTED --> [*]
    REFUNDED --> [*]
```

Khi `decide`, trong một transaction khoá dòng Order:

1. Với mỗi dòng, `k` = tổng `quantity_accepted` của các `returns` `ACCEPTED`/`REFUNDED` trước đó; `N = unit_price × quantity − voucher_discount`; số hoàn dòng = `F(k + n) − F(k)` với `F(x) = (N × x) // quantity` (BR-RET-07 "Làm tròn…"). Không hoàn Phí ship, không tính lại Voucher.
2. Gọi `inventory.restock` cho phần `restock = true` (BR-INV-08).
3. Tổng > 0 → `requestRefund` gắn `return_id`; tổng = 0 → thẳng `REFUNDED`, không tạo Hoàn tiền 0đ.
4. Ghi audit; khi Hoàn tiền gắn với yêu cầu được `record`, yêu cầu chuyển `REFUNDED`.

"Đổi" size/màu = Đổi trả + Staff tạo đơn mới (BR-RET-05).

### 5.2. Ghi nhận Hoàn tiền

Staff hoàn trên trang quản trị VNPay/MoMo (hoặc chuyển khoản cho COD), rồi `record`. Phát `refunds.refund-recorded` → email "Hoàn tiền được ghi nhận" (BR-NTF-01).

## 6. Sự kiện

Phát: `refunds.refund-requested`, `refunds.refund-recorded`.

Lắng nghe: không — các nguồn tạo yêu cầu gọi đồng bộ trong transaction của chúng.

## 7. Job

Không có job riêng. Guard T13 của `ordering` đọc `hasOpen`.

## 8. Bao phủ nghiệp vụ

BR-REF-01..06, BR-RET-01..09, BR-INV-08 (phần Đổi trả), BR-NTF-01 (Hoàn tiền), US-604 AC2, US-605, US-606, US-608; business/05 §4.4; ADR 0006, 0012.

## 9. Câu hỏi mở

- Đổi trả đơn COD: lưu thông tin tài khoản ngân hàng người nhận ở đâu và thời hạn lưu (PII — [`../../business/06-compliance.md`](../../business/06-compliance.md)).
- Có cần chặn ghi nhận Đổi trả khi đơn đang có Yêu cầu xoá dữ liệu `processing` không.
