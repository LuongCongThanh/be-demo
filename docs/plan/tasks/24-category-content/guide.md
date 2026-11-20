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

## Rollout tương thích locale (ticket 01)

`20261119100000_category_locale_translations` thêm `categories.source_version` và bảng
`category_translations`, sao chép duy nhất dòng `en` cho mỗi category. Mọi trạng thái
và tên đã sửa tay được giữ; lease cũ bị bỏ để worker mới có thể nhận lại PENDING.
`nameEn` và `translationStatus` của API là projection từ dòng `en`; request `nameEn`
cũ ghi vào cùng dòng này. Không cần consumers nhập lại bản dịch.

1. Dừng toàn bộ BE/worker bản cũ trước khi migrate; không cho tiến trình cũ ghi
   `categories.name_en`/`translation_*` trong hoặc sau rollout.
2. Sao lưu, chạy `prisma migrate deploy --config prisma7.config.ts`, generate client
   và build/phát hành BE mới. Không drop các cột legacy trong lần này; chúng chỉ còn
   là dữ liệu giữ lại, không được đồng bộ hay dùng làm nguồn đọc.
3. Khởi động BE mới. Thiếu Google key vẫn tạo PENDING bền vững; nhập Anh thủ công,
   đọc locale, sửa/retry và ảnh vẫn hoạt động. Khi có key, worker đọc/claim/ghi từng
   dòng dịch bằng sourceVersion + revision + lease, không gọi provider trong transaction.
4. Kiểm tra GET admin/store, sửa Việt sau MANUAL → REVIEW, và retry giữ tên hiện có
   đến khi dịch thành công. Không rollback chạy BE cũ vì cột legacy đã ngừng cập nhật;
   phục hồi cần bản BE tương thích bảng mới hoặc kế hoạch khôi phục dữ liệu riêng.

Ticket 01 chỉ chuyển Việt/Anh hiện có. API quản lý ngôn ngữ thuộc ticket 02;
ticket 03 tiếp tục đặc tả và nghiệm thu chỉnh sửa tay/retry riêng theo locale.

## Ngôn ngữ category (ticket 02)

`vi` là ngôn ngữ nguồn và không thể tắt. Danh sách locale được hỗ trợ là allowlist
của BE; `vi` và `en` được seed idempotent. Locale bật/tắt không thay đổi slug hay
URL identity của category.

- Storefront: `GET /api/v1/languages` liệt kê locale đang bật.
- CMS: `GET /api/v1/admin/languages` đọc cấu hình; `PATCH /api/v1/admin/languages/:locale`
  với `{ "enabled": true }` hoặc `{ "enabled": false }` yêu cầu quyền category manage.
- Storefront: `GET /api/v1/categories` và `GET /api/v1/categories/:id` nhận
  `?locale=...`; mặc định `vi`, locale không hợp lệ/chưa bật trả 400, tên thiếu
  bản dịch fallback về tiếng Việt.

Khi bật locale, các category hiện có được đưa vào durable queue. Worker dịch tối đa
10 bản dịch mỗi batch và tiếp tục từ dữ liệu đã lưu sau khi process khởi động lại.
Tạo category và bật locale dùng chung transaction lock: nếu tạo trước, backfill
sẽ thấy category; nếu bật trước, thao tác tạo sẽ đọc locale đã bật. Tắt locale
không xóa bản dịch; bật lại giữ `MANUAL`/`REVIEW` và đưa bản máy lỗi thời về
`PENDING`. Generation ngăn kết quả của lần bật cũ ghi đè trạng thái mới.

Integration test dùng fake provider cho `fr`, `de`, `es`; không gọi Google Cloud
Translation và không cần API key thật.
