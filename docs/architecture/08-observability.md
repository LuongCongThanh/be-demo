# 08. Quan sát hệ thống (Observability)

> Trạng thái: **Đã chốt cho MVP**. Liên quan: [07-async-events-jobs.md](./07-async-events-jobs.md), [05-auth-security.md](./05-auth-security.md), [ADR 0008](../adr/0008-redis-outage-degrades-not-unready.md).

Mục tiêu: luôn trả lời được "tiền và tồn kho của đơn này đang ở đâu" và phát hiện sớm việc kẹt trước khi Người mua báo.

## 1. Log

- **JSON có cấu trúc**, một dòng một sự kiện: `timestamp`, `level`, `request_id`, `module`, `message`, ngữ cảnh (order_id, payment_id…).
- `request_id` lấy từ header `X-Request-Id` hoặc sinh mới, lan truyền qua `AsyncLocalStorage` tới mọi log trong request; job/consumer dùng `event_id`/`job_id` làm correlation id và mang theo `request_id` gốc nếu có.
- Mức log: lỗi 5xx và lỗi không mong đợi ở `error`; 4xx không log ở `error` (lỗi của client, không phải sự cố).
- **Che PII** (email, SĐT, địa chỉ, tên) trước khi ghi; IP chỉ ghi dạng HMAC ([05-auth-security.md](./05-auth-security.md) mục 8). Lưu 30 ngày (business/06 mục 5).
- Lỗi gửi về Sentry với data scrubbing bắt buộc bật.

**Audit log** (khác log ứng dụng, lưu trong DB): mọi thao tác ghi back-office — ai, lúc nào, trước/sau (business/02 mục 4), điều chỉnh Tồn kho (BR-INV-09), chuyển trạng thái Đơn, Hoàn tiền.

## 2. Metric

| Nhóm       | Metric                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP       | Latency P50/P95/P99 theo route, tỷ lệ lỗi 5xx, số request                                                                                |
| Checkout   | Số đơn tạo, số lần từ chối vì Tính thử lệch (BR-ORD-07), vì hết hàng (BR-INV-06)                                                         |
| Thanh toán | IPN nhận/lỗi chữ ký/trùng; Thanh toán treo chờ đối soát; số đơn hết hạn T4                                                               |
| Tồn kho    | Số Giữ hàng đang hiệu lực, Giữ hàng hết hạn                                                                                              |
| Async      | Độ dài queue, job thất bại, outbox `pending`/`enqueued` theo tuổi, inbox chưa áp dụng (`applied_at`/`processed_at` null) và đã ngừng thử |
| Hạ tầng    | CPU, bộ nhớ, số kết nối PostgreSQL đang dùng/chờ, bộ nhớ Redis                                                                           |

Xuất theo chuẩn Prometheus (OpenTelemetry metrics).

## 3. Tracing

OpenTelemetry trace cho HTTP, Prisma và lời gọi ra ngoài (VNPay, MoMo, GHN, email). Trace id gắn với `request_id` và được truyền qua job BullMQ để nối được đường đi request → outbox → consumer.

## 4. Cảnh báo

**Cho đội kỹ thuật:**

- Outbox `enqueued` quá 15 phút, hoặc backlog `pending` tăng liên tục.
- Inbox đã ngừng thử mà chưa áp dụng (07 mục 1.3); IPN lỗi chữ ký tăng đột biến.
- Job định kỳ không chạy đúng lịch (đặc biệt job huỷ đơn và đối soát).
- Tỷ lệ 5xx, P95 latency vượt ngưỡng ở [10-nfr.md](./10-nfr.md); pool kết nối DB cạn.
- Readiness thất bại.

**Cho Staff (Cờ cần xử lý trên back-office, kèm thông báo):** `amount_mismatch` (BR-PAY-04), tiền về cho đơn không còn chờ thanh toán (BR-PAY-05), yêu cầu Hoàn tiền mới, tạo Vận đơn thất bại (T10), `shipment_exception` (BR-SHP-08), Vận đơn bị tạo cho đơn đã huỷ (business/05 mục 4.5), đơn Hoàn hàng chờ nhận về Kho.

## 5. Health check

| Endpoint            | Kiểm tra                    | Dùng cho                      |
| ------------------- | --------------------------- | ----------------------------- |
| `GET /health/live`  | Process còn chạy            | Restart container             |
| `GET /health/ready` | Kết nối được **PostgreSQL** | Load balancer nhận/bỏ replica |

Redis **không** nằm trong readiness: Redis lỗi chỉ làm suy giảm tính năng (ADR 0008, [07](./07-async-events-jobs.md) mục 5), được báo qua metric và cảnh báo. Worker có health riêng: còn kết nối PostgreSQL và job định kỳ chạy đúng lịch.
