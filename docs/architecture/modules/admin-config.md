# Module `admin-config`

> Trạng thái: **Bản nháp cho tái cấu trúc** ([quy ước](../../README.md#trạng-thái-tài-liệu)). Bảng: [`../11-database.md`](../11-database.md). Ranh giới: [`../02-modules.md`](../02-modules.md). Nguồn nghiệp vụ: [business/03](../../business/03-user-stories.md) US-1002, [business/02](../../business/02-actors-permissions.md) §4.

## 1. Trách nhiệm

- Sở hữu: cấu hình vận hành sửa được (Phí ship dự phòng, ngưỡng miễn phí ship, hạn mức COD — BR-PAY-06) và audit log back-office.
- Không cấu hình được: thời gian Giữ hàng 15 phút và hạn link 10/7 phút (BR-INV-05) — hằng số trong code. Thông tin doanh nghiệp và chính sách là nội dung tĩnh của Frontend (business/06 §4).

## 2. Mô hình

Chi tiết cột, ràng buộc, enum: [`../11-database.md` §4.12](../11-database.md#412-admin-config).

- `settings` — giá trị cấu hình do Admin chỉnh: `key` text tự do (vd. `cod.max_order_total`), `value` jsonb; danh sách key hợp lệ và schema giá trị validate ở service

`audit_logs` (nhật ký thao tác back-office, [§4.1](../11-database.md#41-identity)) cũng thuộc module này.

## 3. Interface cho module khác

| Hàm | Dùng bởi |
|---|---|
| `getSetting(key)` (cache ngắn, nguồn PostgreSQL) | `ordering` (hạn mức COD), `fulfillment` (phí dự phòng, ngưỡng miễn phí) |
| `audit(entry, tx)` | Mọi thao tác **ghi** của module back-office, `identity` (CLI, `actor_user_id = null`). Lượt xem dữ liệu cá nhân không ghi ở đây mà ở `data_access_logs` (`compliance`) |

## 4. API

| Method | Path | Actor | Ghi chú |
|---|---|---|---|
| `GET` | `/admin/settings` | staff, admin | |
| `PATCH` | `/admin/settings/:key` | admin | Ghi audit với giá trị trước/sau (US-1002 AC1) |
| `GET` | `/admin/audit-logs` | admin | Lọc theo actor, đối tượng, thời gian |

## 5. Luồng

Sửa cấu hình: một transaction cập nhật `settings` + ghi `audit_logs`; xoá cache. Giá trị mới chỉ áp dụng cho Tính thử tạo sau đó; Tính thử cũ lệch sẽ bị `409 QUOTE_CHANGED` (ADR 0013).

## 6. Sự kiện

Không phát, không nghe.

## 7. Job

Không có. Thời hạn lưu audit log theo [business/06](../../business/06-compliance.md) §5.

## 8. Bao phủ

US-1002; business/02 §4; BR-PAY-06.

## 9. Câu hỏi mở

- Staff có được xem `/admin/settings` không? Business chỉ nói Admin sửa — đề xuất: Staff xem, Admin sửa.
