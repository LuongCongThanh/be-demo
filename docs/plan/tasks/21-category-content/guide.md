# Hướng dẫn tích hợp

CMS tiếp tục gửi name Việt. Cho nhập nameEn để override, đọc translationStatus (PENDING/TRANSLATED/MANUAL/REVIEW/FAILED), nút retry gọi POST translation/retry. Null nameEn xóa override và yêu cầu dịch lại. Store thêm locale vào request categories, dùng name đã resolve; slug luôn giữ nguyên. Ảnh: tạo category trước, presign theo id và slot, upload form thẳng Cloudinary rồi attach storageKey. Gỡ ảnh gửi storageKey:null. Hai consumer cần regenerate API client; BE không tự cập nhật cache ứng dụng.

## Ví dụ API

Tạo: `POST /api/v1/admin/categories` với `{ "name": "Áo thun" }` → trạng thái PENDING, slug `ao-thun`. Sau dịch lưu nameEn `T-shirt`; nếu cần chỉnh tên theo cửa hàng thì PATCH với `{ "nameEn": "T-shirts" }` → MANUAL.

`GET /api/v1/categories/:id?locale=en` → name `T-shirts`, nameVi `Áo thun`, nameEn `T-shirts`, slug `ao-thun`. Với `locale=vi`, name `Áo thun`. Cả hai locale dùng cùng id/slug. CMS admin response luôn giữ name Việt. Store phải đưa locale vào cache key của request category.

Đổi Việt sang `Áo thun cotton` sau khi sửa Anh: giữ `T-shirts`, chuyển REVIEW. Admin sửa nameEn để xác nhận hoặc gọi retry để thay bằng dịch máy. Retry giữ tên hiện có cho tới thành công; nếu đã FAILED thì vẫn fallback Việt khi chưa có bản Anh.

## Rollout

1. Sao lưu và áp migration trong môi trường đích bằng `npx prisma migrate deploy --config prisma7.config.ts`; không dùng reset. Generate/build/release BE mới trước consumer.
2. Chưa có key: để GOOGLE_TRANSLATE_API_KEY trống, dữ liệu cũ/mới PENDING và vẫn hoạt động với fallback Việt. Có thể nhập Anh thủ công.
3. Bật Cloud Translation Basic v2 trong Google Cloud project, giới hạn key cho API này, đặt quota theo ngân sách. Set GOOGLE_TRANSLATE_API_KEY phía server rồi restart; category PENDING được xử lý theo batch tối đa 10, timeout mỗi lần 10s. Không cần script backfill khác. MANUAL/REVIEW được bỏ qua. FAILED chỉ retry chủ động.
4. Đồng bộ contract `docs/openapi/openapi.json` cho consumer, triển khai CMS và store; kiểm tra cache theo locale, sửa Anh/retry, hai slot upload, điều hướng và lọc nhánh ẩn. BE chưa phát hành tag OpenAPI hay deploy trong phiên này.
5. Kiểm thử một category trong môi trường đích sau cấu hình key. Lượt test ở đây dùng fake vendor/storage; chưa xác minh credential hay bản dịch Google thật.

Tài liệu provider: [Google Cloud Translation text API](https://docs.cloud.google.com/translate/docs/translate-text). Worker nằm trong tiến trình API; cần một instance hoạt động để hàng đợi tiếp tục chạy. Tắt worker bằng bỏ key và restart; tên đã dịch vẫn được lưu.
