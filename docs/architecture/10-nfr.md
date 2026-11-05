# 10. Yêu cầu phi chức năng (NFR)

> Trạng thái: **Nháp**. Mọi con số đánh dấu Giả định là **[Giả định · kiểm chứng: k6 trên staging]** — mục tiêu thiết kế, không phải cam kết SLA.

## 1. Quy mô

| Chỉ số | Giả định MVP | Nguồn |
|---|---|---|
| Đơn hàng/ngày | 500–5.000 | [01-vision-scope.md](../business/01-vision-scope.md) mục 6 |
| Đơn giờ cao điểm | ~20% đơn/ngày trong 1 giờ → tới ~1.000 đơn/giờ | [Giả định · kiểm chứng: k6 trên staging] |
| Tỷ lệ xem/đặt | ~50 request đọc cho mỗi đơn | [Giả định · kiểm chứng: k6 trên staging] |
| Đỉnh khuyến mãi | ×5 lưu lượng bình thường trong 15 phút | [Giả định · kiểm chứng: k6 trên staging] |
| Sản phẩm / Biến thể | ~5.000 / ~50.000 | [Giả định · kiểm chứng: k6 trên staging] |

## 2. Hiệu năng

| Thao tác | P95 mục tiêu |
|---|---|
| Danh sách / tìm kiếm / chi tiết Sản phẩm | < 300 ms |
| Giỏ hàng | < 200 ms |
| Tính thử | < 800 ms (gồm gọi phí ship GHN; quá hạn thì dùng phí dự phòng) |
| Đặt đơn | < 1 s |
| Xử lý IPN (lưu inbox, trả `2xx`) | < 200 ms |

**Kiểm chứng:** kịch bản k6 trên staging — duyệt Sản phẩm, thêm giỏ, Tính thử, đặt đơn đồng thời trên cùng Biến thể ít hàng. Điều kiện đạt: P95 trong ngưỡng, **không bán vượt** (BR-INV-02), không tạo đơn trùng, không lỗi 5xx do hết kết nối DB.

## 3. Độ sẵn sàng và phục hồi

| Mục | [Giả định · kiểm chứng: k6 trên staging] |
|---|---|
| Availability API | 99,5%/tháng |
| RPO | ≤ 5 phút (point-in-time recovery của PostgreSQL) |
| RTO | ≤ 1 giờ |
| Redis lỗi | Không làm API `unready`, không mất dữ liệu nghiệp vụ ([ADR 0008](../adr/0008-redis-outage-degrades-not-unready.md)) |
| Cổng thanh toán / GHN lỗi | Đơn không bị mất: Đối soát bù lại; tính phí ship dùng phí dự phòng ([06-integrations.md](./06-integrations.md)) |

## 4. Tính đúng đắn (ưu tiên hơn hiệu năng)

- Không bán vượt tồn kho; mọi thay đổi Tồn kho/Giữ hàng trong transaction có khoá dòng.
- Thông báo thanh toán lặp chỉ xử lý một lần (BR-PAY-03); đặt đơn có idempotency key.
- Tổng hoàn không vượt số thực nhận (BR-REF-06).

## 5. Ngân sách kết nối PostgreSQL

`tổng kết nối = (số replica API × pool API) + (số worker × pool worker) + dự phòng migration/admin` phải nhỏ hơn `max_connections` của DB, chừa ≥ 20%.

Ví dụ khởi điểm: 2 API × 10 + 1 worker × 5 + 5 = 30 kết nối, phù hợp instance nhỏ (`max_connections` ~100). Khi scale thêm replica mà vượt ngân sách, thêm connection pooler (PgBouncer/RDS Proxy) trước khi tăng instance DB. Transaction giữ khoá phải ngắn và không gọi ra ngoài (GHN, Cổng thanh toán) bên trong transaction.

## 6. Lưu trữ dữ liệu

Thời hạn lưu log, EmailLog, outbox và các dữ liệu còn chờ pháp chế chốt: xem [06-compliance.md](../business/06-compliance.md) mục 5. Job dọn dẹp: [07-async-events-jobs.md](./07-async-events-jobs.md) mục 4.

## 7. Bảo mật và tuân thủ

Xem [05-auth-security.md](./05-auth-security.md) và [06-compliance.md](../business/06-compliance.md).
