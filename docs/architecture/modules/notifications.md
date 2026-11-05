# Module `notifications`

> Trạng thái: **Đã chốt cho MVP**. Nguồn nghiệp vụ: [`../../business/04-business-rules.md`](../../business/04-business-rules.md) §10, [`../../business/06-compliance.md`](../../business/06-compliance.md) §5. Kỹ thuật: [`../07-async-events-jobs.md`](../07-async-events-jobs.md) §2–3, [ADR 0007](../../adr/0007-outbox-done-means-downstream-ack.md). Bảng: [`../11-database.md`](../11-database.md).

## 1. Trách nhiệm

- Lắng nghe domain event và gửi email giao dịch đúng danh sách BR-NTF-01, đúng ngôn ngữ (BR-NTF-02), bỏ qua Khách vãng lai không có email (BR-NTF-03).
- Ghi `email_logs`, chống gửi trùng, ẩn PII sau 90 ngày.
- Không module nghiệp vụ nào phụ thuộc vào `notifications` để hoàn thành transaction ([`../02-modules.md`](../02-modules.md) §3). Gửi email thất bại không làm hỏng đơn.
- Hạ tầng outbox (`outbox_events`, dispatcher, quét kẹt) là của `outbox` dùng chung; tài liệu này mô tả nó vì `notifications` là consumer chính.

## 2. Mô hình

Chi tiết cột, ràng buộc, enum: [`../11-database.md` §4.10](../11-database.md#410-notifications).

- `outbox_events` — transactional outbox
- `email_logs` — nhật ký gửi email, chống gửi trùng

## 3. Email theo sự kiện

| Sự kiện | Email | Ghi chú |
|---|---|---|
| `ordering.order-placed` | Đặt đơn thành công | Chỉ COD (T2) |
| `ordering.order-paid` | Thanh toán thành công | T3 |
| `ordering.order-cancelled` | Đơn đã huỷ | Không gửi cho T4/T5 — đơn online chưa thanh toán (BR-NTF-01) |
| `fulfillment.shipment-created` | Đơn đang được giao | T10 |
| `fulfillment.shipment-delivered` | Đã giao | T11 |
| `refunds.refund-recorded` | Hoàn tiền được ghi nhận | US-605 |
| `ordering.unexpected-payment-received` | Tiền sẽ được hoàn (kèm "đơn đã hết hạn" nếu đã huỷ) | Ngoại lệ BR-NTF-01, business/05 §4.1 |
| `identity.email-verification-requested`, `identity.password-reset-requested` | Email tài khoản | US-501, US-503 |

Ngôn ngữ: `users.locale` của Khách hàng; Khách vãng lai dùng `orders.locale` lúc đặt. Tên Sản phẩm luôn tiếng Việt (bản chụp trên Dòng đơn hàng).

## 4. Luồng

```mermaid
sequenceDiagram
    participant D as Outbox dispatcher
    participant Q as BullMQ
    participant N as notifications
    participant DB as PostgreSQL
    participant M as Mailer

    D->>DB: đọc outbox pending
    D->>Q: enqueue (jobId = event_id)
    D->>DB: enqueued
    Q->>N: job
    N->>DB: đọc đơn/người nhận; đã có email_logs sent cho outbox_event_id + template → dừng
    alt không còn đúng (vd. trạng thái đơn đã đổi) / không có email
        N->>DB: email_logs cancelled, outbox done
    else
        N->>M: send(template, locale)
        alt OK
            N->>DB: email_logs sent, outbox done
        else lỗi tạm thời
            N->>Q: retry backoff
        else lỗi vĩnh viễn / hết retry
            N->>DB: email_logs failed, outbox failed + cảnh báo
        end
    end
```

Chống gửi trùng: BullMQ `jobId = event_id` + UK `(outbox_event_id, template)` trên `email_logs`. `outbox done` chỉ đặt **sau** khi email đã gửi hoặc đã kết luận (ADR 0007).

## 5. API

Không có API storefront. Back-office: `GET /api/v1/admin/email-logs?orderId=` (staff) để tra cứu email đã gửi cho đơn — mỗi lần mở được ghi `data_access_logs` (`action = view_order`, `order_id`) vì có địa chỉ nhận (CMP-07, module `compliance`).

## 6. Sự kiện

Lắng nghe: bảng §3. Phát: không.

## 7. Job

| Job | Tần suất |
|---|---|
| Outbox dispatcher | Liên tục |
| Quét outbox kẹt `enqueued` | Mỗi 5 phút |
| Xoá outbox `done` > 90 ngày; `email_logs.recipient`, `amount` = null sau 90 ngày | Mỗi ngày |

## 8. Bao phủ nghiệp vụ

BR-NTF-01..03, business/06 §5 (EmailLog, outbox), US-605 AC1; ADR 0003, 0007, 0008.

## 9. Câu hỏi mở

- Chọn email provider (SMTP hay API) và cách nhận bounce để đánh dấu lỗi vĩnh viễn.
- Email marketing (CMP-03) ngoài MVP — chỉ lưu lựa chọn, không gửi.
