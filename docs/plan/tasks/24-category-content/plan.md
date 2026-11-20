# Kế hoạch

## Giai đoạn A — bản Việt/Anh đã triển khai

1. Audit CRUD/tree/product filtering và upload có sẵn; ghi contract và migration additive.
2. Slug ổn định; thêm nameEn, trạng thái và version/lease; API locale và response mapper.
3. Google adapter + worker DB lease, retry ADMIN, chống stale results và optimistic conflict khi sửa.
4. Hai ảnh qua Cloudinary presign/attach, không dựng lại media infrastructure.
5. Sửa product query cho nhánh hiển thị; giữ tìm kiếm toàn catalog.
6. Unit tests lifecycle/race/provider/media, HTTP e2e category/locale/permission/filter. Migrate DB test cô lập, không reset DB hiện có.
7. Generate OpenAPI; cập nhật business rules, module/database docs, report và tracker. CMS/store cần regenerate client từ contract BE mới.

## Giai đoạn B — mở rộng đa ngôn ngữ đã thống nhất

Ticket 01 (mô hình bản dịch theo locale) và ticket 02 (bật/tắt ngôn ngữ, worker
và backfill) đã hoàn tất ở BE. Ticket 03 về editorial translations và bàn giao
consumer CMS/store vẫn còn trong phạm vi kế hoạch.

Đầu vào: các xác nhận ở phần thiết kế đa ngôn ngữ trong [spec](spec.md). Chỉ mở rộng nội dung Category; không tự dịch chữ giao diện, Product hoặc bổ sung locale UI của store.

### 1. Dữ liệu và chuyển đổi tương thích

- Giữ categories.name làm nguồn Việt và giữ nguyên id/slug/parent/order/visibility/media.
- Thêm danh sách ngôn ngữ với locale, tên hiển thị, cờ enabled; seed Việt/Anh idempotent. Tiếng Việt là nguồn bắt buộc, không cho tắt.
- Thêm category_translations: categoryId, locale, name nullable, trạng thái, sourceVersion, revision, leaseUntil, timestamps; unique(categoryId, locale), FK và index cho worker. Version nguồn trên category tăng khi tên Việt đổi; revision bản dịch tăng khi sửa tay/retry.
- Migration additive chuyển nameEn/trạng thái sang dòng en, giữ MANUAL/REVIEW/FAILED và giá trị hiện có; lease đang chạy không tái sử dụng. Không sửa/xóa migration trước, không drop cột cũ ngay.
- Giữ nameEn/translationStatus của API cũ làm projection của dòng en; request nameEn cũ ghi vào dòng en. Một nguồn dữ liệu bản dịch duy nhất. Chỉ gỡ cột/API cũ ở lần cleanup sau khi consumers đã chuyển.
- Không chạy đồng thời worker cũ và mới trong rollout; dừng worker cũ, migrate, rồi chạy bản mới. Dữ liệu pending có thể dịch lại an toàn.

### 2. API và quyền

- Public GET /languages trả ngôn ngữ đang bật; ban đầu vi/en. Việc này mô tả locale nội dung category, không bảo đảm giao diện store đã có bản dịch cho locale đó.
- Admin GET /admin/languages và PATCH /admin/languages/:locale {enabled}; reuse quyền category view/manage. Giới hạn locale theo danh sách provider hỗ trợ, không nhận mã tùy ý rồi gọi dịch vụ.
- GET /categories và /categories/:id nhận locale được bật, default vi; name đã resolve, fallback Việt khi thiếu bản dịch. Locale không hợp lệ/chưa bật trả 400; giữ các trường compatibility hiện có.
- Admin GET /admin/categories/:id/translations trả các bản dịch kèm trạng thái để chọn locale; PATCH /admin/categories/:id/translations/:locale {name} sửa tay, name:null yêu cầu tự dịch lại; POST .../:locale/retry cho retry chủ động.
- Retry cũ không có locale tiếp tục nhắm en. Update tên Việt giữ bản sửa tay từng locale và đánh dấu REVIEW, queue lại bản máy cho các ngôn ngữ bật.
- Ghi request/response/error cụ thể trong DTO/OpenAPI và guide trước khi đổi consumer.

### 3. Worker và bật/tắt ngôn ngữ

- Google adapter nhận target locale. Worker claim và complete theo từng bản dịch, kiểm tra sourceVersion/revision/lease để bỏ kết quả cũ.
- Lưu tên Việt không chờ provider. Bật thêm locale tạo công việc nền cho category thiếu bản dịch theo batch; có thể tiếp tục sau restart. Dùng unique/upsert chống queue trùng khi bật lại hoặc tạo category đồng thời.
- Giữ bản dịch khi tắt locale, ngừng claim công việc locale đó. Bật lại giữ MANUAL; bản máy lỗi thời queue lại, bản tay lỗi thời đánh dấu REVIEW.
- Thiếu key: worker tắt, không mất công việc; lỗi provider -> FAILED, retry theo locale. Không gọi HTTP trong transaction.

### 4. Kiểm chứng BE

- Migration trên DB tạm có dữ liệu bản cũ: ids/slugs/tên Anh/manual/review được giữ, adapter compatibility đọc/ghi cùng dữ liệu mới.
- Ba locale thử nghiệm: tạo/đổi tên nguồn, sửa tay một locale, các locale khác dịch độc lập; thiếu bản dịch fallback Việt.
- Bật/tắt/bật lại locale, backfill sau restart, category được tạo đồng thời với enable; không xóa bản dịch hay tạo duplicate.
- Kết quả dịch cũ sau rename/manual/retry/delete/disable không làm sai trạng thái; nhiều worker không cùng commit công việc đã mất lease.
- Quyền, input sai, chặn tắt locale nguồn; unit + HTTP/integration PostgreSQL, lint/typecheck/build và regenerate OpenAPI. Fake provider/storage trong test.

### 5. Bàn giao consumers sau khi BE ổn định

- CMS: quản lý bật/tắt locale, form tên Việt, dropdown locale + một ô sửa bản dịch, trạng thái/retry theo locale. Tái dùng ảnh và quản trị cây có sẵn.
- Store: đọc locale được hỗ trợ trong giao diện hiện có, gửi locale cho category và đưa locale vào cache key; dùng name đã resolve, giữ slug/breadcrumb/filter.
- Nghiệm thu BE → CMS → store với Việt/Anh trước. Nếu thêm ngôn ngữ giao diện mới, tạo phạm vi riêng cho bản dịch UI/router/formatting; bật dịch category không tự hoàn thành phần đó.

## Bước tiếp theo

Tiếp tục với ticket 03 về editorial translations theo locale, sau đó bàn giao
contract cho CMS/store và nghiệm thu luồng end-to-end. Các quyết định sản phẩm
trong spec đã được xác nhận; không cần hỏi lại.
