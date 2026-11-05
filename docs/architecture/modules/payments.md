# Module `payments`

> Trạng thái: **Đã chốt cho MVP**. Nguồn nghiệp vụ: [`../../business/04-business-rules.md`](../../business/04-business-rules.md) §7, [`../../business/05-order-lifecycle.md`](../../business/05-order-lifecycle.md) §4.1, §4.6. Quyết định: [ADR 0004](../../adr/0004-payment-gateways-vnpay-momo-cod.md), [ADR 0006](../../adr/0006-manual-refund-mvp-scope.md). Tích hợp: [`../06-integrations.md`](../06-integrations.md) §2. Bảng: [`../11-database.md`](../11-database.md).

## 1. Trách nhiệm

- Sở hữu: Thanh toán online (mỗi lần thử một bản ghi), thông báo thô từ Cổng (IPN, kết quả Đối soát), khoản thu COD.
- Adapter `PaymentGateway` cho VNPay và MoMo; tạo link thanh toán; xác minh chữ ký; Đối soát.
- Quyết định một thông báo có phải **bằng chứng đã thu tiền** (chỉ khi Cổng báo đã thu — `captured`) và số tiền có khớp không (BR-PAY-04).
- Không sở hữu: trạng thái Đơn (`ordering`), Hoàn tiền (`refunds-returns`). Thanh toán thành công được báo cho `ordering` qua interface `ordering.onPaymentSucceeded` (ordering khai báo, payments gọi — không import ngược, [`../02-modules.md`](../02-modules.md) §3); khoản thu sai gọi `refunds-returns.requestRefund`.

## 2. Mô hình

Chi tiết cột, ràng buộc, enum: [`../11-database.md` §4.7](../11-database.md#47-payments).

- `payments` — mỗi lần thử thanh toán online
- `payment_notifications` — inbox thô IPN/Đối soát của Cổng
- `cod_collections` — khoản thu COD của đơn

## 3. Interface public

| Hàm | Gọi bởi | Ghi chú |
|---|---|---|
| `createPending(tx, order)` | `ordering` (T1) | Ghi nhận đơn online chờ thanh toán; chưa tạo link |
| `createCodReceivable(tx, order)` | `ordering` (T2) | Tạo `cod_collections` `pending` |
| `markCodCollected(tx, orderId)` / `cancelCodReceivable(tx, orderId)` | `ordering` (T11 / T7, T9, T12, T14) | |
| `capturedPaymentsOf(orderId)` | `refunds-returns` | Thanh toán đã nhận tiền để gắn Hoàn tiền (BR-REF-01) |

## 4. API

Prefix `/api/v1`, quy ước ở [`../03-api.md`](../03-api.md).

| Method | Path | Actor | Ghi chú |
|---|---|---|---|
| `POST` | `/orders/:code/payments` | owner / guest có phiên | Body `{ gateway }`. Tạo `payments` (`status = pending`, `gateway_txn_ref`, `payment_url_expires_at`) + link. Từ chối nếu đơn không `PENDING_PAYMENT` hoặc đã qua phút 7 (BR-INV-05). Bắt buộc `Idempotency-Key` |
| `GET` | `/orders/:code/payments/latest` | owner / guest có phiên | Trang Return URL hỏi trạng thái; chỉ đọc, không xác nhận (BR-PAY-02) |
| `POST` | `/webhooks/vnpay/ipn` | VNPay | Xác minh chữ ký, lưu inbox, trả đúng định dạng VNPay |
| `POST` | `/webhooks/momo/ipn` | MoMo | Như trên |
| `GET` | `/admin/payments?orderId=` | staff | Lịch sử thử thanh toán của đơn |

## 5. Luồng

### 5.1. Trả tiền online

```mermaid
sequenceDiagram
    actor B as Người mua
    participant P as payments
    participant G as VNPay/MoMo
    participant W as worker
    participant O as ordering
    participant R as refunds-returns

    B->>P: POST /orders/:code/payments {gateway}
    P->>P: kiểm tra PENDING_PAYMENT, now < placed_at + 7'
    P->>G: createPaymentLink(expiresAt = placed_at + 10')
    P-->>B: url
    B->>G: trả tiền
    G->>P: IPN (ký)
    P->>P: verify, lưu payment_notifications (UK gateway, dedup_key)
    P-->>G: 2xx
    W->>P: xử lý notification
    alt không captured
        P->>P: payments failed/giữ pending, không tạo nghĩa vụ hoàn (BR-PAY-04)
    else captured, số tiền khác tổng
        P->>R: requestRefund(amount_captured, reason=amount_mismatch) + Cờ amount_mismatch
    else captured, khớp
        P->>O: onPaymentSucceeded(tx, paymentId)
        alt đơn còn PENDING_PAYMENT (hoặc quá hạn nhưng còn hàng)
            O->>O: T3
        else đơn đã huỷ / đã PLACED bởi lần trả khác
            O->>R: requestRefund(reason=unexpected_payment) + Cờ unexpected_payment (BR-PAY-05)
        end
    end
```

Toàn bộ bước "xử lý notification" chạy trong một transaction có khoá dòng Order ([`../04-data-consistency.md`](../04-data-consistency.md)). Thông báo lặp của chính khoản đã đưa đơn vào `PLACED` bị bỏ qua (business/05 §4.1).

### 5.2. Đối soát

Job mỗi 5 phút gọi `gateway.query(gateway_txn_ref)` cho `payments` `pending` đã có link, kể cả sau khi link hết hạn (tới khi Cổng trả kết quả cuối). Kết quả ghi thành `payment_notifications` (cùng UK `(gateway, dedup_key)` nên trùng với IPN đã nhận thì bỏ qua) và đi cùng đường xử lý §5.1; khi đưa `payments` sang `succeeded` thì ghi `confirmed_via = reconciliation` (IPN: `ipn`), `gateway_txn_id`, `amount_captured`, `succeeded_at`.

## 6. Sự kiện

Phát (qua outbox, [`../07-async-events-jobs.md`](../07-async-events-jobs.md) §2): `payments.amount-mismatch`. `ordering.order-paid` và `ordering.unexpected-payment-received` do `ordering` phát trong cùng transaction.

Lắng nghe: không có — mọi thay đổi đến từ IPN/Đối soát hoặc lời gọi đồng bộ của `ordering`.

## 7. Job

| Job | Tần suất |
|---|---|
| Đối soát Thanh toán treo | Mỗi 5 phút |
| Xử lý `payment_notifications` tồn đọng (`processed_at IS NULL`) | Liên tục (consumer) |

Khi inbox dồn ứ, `payments` báo cờ "backlog" để job huỷ đơn hết hạn của `ordering` tạm dừng ([`../07-async-events-jobs.md`](../07-async-events-jobs.md) §1.2).

## 8. Bao phủ nghiệp vụ

BR-PAY-01..06, BR-SHP-07, BR-INV-05 (phút 7/10), US-305, US-306, US-608 (phần tạo yêu cầu), business/05 §4.1, §4.6; ADR 0004, 0006.

## 9. Câu hỏi mở

- Định dạng và danh sách trạng thái giao dịch thực tế của VNPay/MoMo (pending/authorized/captured) — chốt khi nghiệm thu sandbox.
- Cổng có cho truyền `expiresAt` tuyệt đối không; nếu chỉ nhận thời lượng thì tính lại tại lúc tạo link.
