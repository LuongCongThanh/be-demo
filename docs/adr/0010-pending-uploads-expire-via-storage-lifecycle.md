---
decision_status: accepted
implementation_status: implemented
decided_at: 2026-09-23
last_verified: 2026-09-23
related_spec: ../specs/03-products.md
---

# Pending Upload nằm ở prefix `tmp/`, storage lifecycle tự xoá, copy sang prefix chính khi gắn

Bối cảnh: client upload ảnh trực tiếp lên S3-compatible storage bằng presigned POST (`POST /upload-images/presign`), rồi mới gửi `key` vào `POST`/`PATCH /products`. Giữa hai bước, client có thể bỏ ngang (huỷ form, request bị 400, tắt tab), để lại file không được tham chiếu vĩnh viễn trên bucket. Có ba phương án:

- (A) Presign trả key dưới `tmp/<purpose>/`; bucket có lifecycle rule xoá object dưới `tmp/` sau 1 ngày; khi gắn vào Product, server `HEAD` key tạm rồi `CopyObject` sang `products/<productId>/…`, lưu URL chính, xoá bản tạm best-effort.
- (B) Upload kèm tag `status=pending`, lifecycle xoá theo tag, gỡ tag khi gắn — không cần copy, nhưng presigned POST + tagging và lifecycle theo tag không được hỗ trợ đồng đều giữa các provider (ví dụ Cloudflare R2).
- (C) Bảng `uploads` ghi trạng thái `PENDING`/`ATTACHED` + cron xoá bản ghi `PENDING` quá hạn và object tương ứng — kiểm soát tối đa nhưng thêm bảng, migration và job chạy nền.

Chọn (A): việc dọn giao hoàn toàn cho storage (không bảng, không cron, không code dọn), chỉ đổi lại một `CopyObject` server-side mỗi ảnh gắn mới. Key chính nhóm theo `productId`, tiện debug và dọn khi xoá Product. Rủi ro còn lại: copy thành công nhưng transaction DB thất bại → object chính thành rác; service xoá best-effort các bản copy trong nhánh lỗi.

Hệ quả: môi trường nào dùng module `upload-image` cũng **bắt buộc** cấu hình lifecycle rule `tmp/ → expire 1 ngày` trên bucket (local dev: service `minio-init` trong `docker-compose.yml`). Thiếu rule thì Pending Upload tích tụ vô hạn nhưng không gây lỗi nghiệp vụ. Đổi sang (B)/(C) sau này đòi hỏi đổi định dạng key và migrate object đang có.
