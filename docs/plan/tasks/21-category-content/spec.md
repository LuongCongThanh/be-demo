---
status: in-progress
pr:
blocked-by: []
---

# Hoàn thiện hợp đồng category cho CMS và store

## Phạm vi được xác nhận ngày 2026-11-19

- Giữ cây loại sản phẩm, một category/product, Gender riêng, quyền hiện tại và RESTRICT.
- Slug chỉ sinh khi tạo từ tên Việt, ổn định khi đổi tên/cha/locale; giữ toàn bộ slug cũ, không thêm redirect hay sửa slug thủ công. Trùng slug khi tạo trả 409; tên hiển thị sau rename không phải unique identity.
- `name` là tên Việt để tương thích; `nameEn` là bản dịch Anh. Store `locale=vi|en` mặc định vi; `name` trả theo locale, `nameVi`/`nameEn` là dữ liệu gốc. Thiếu tiếng Anh fallback Việt.
- Tự dịch Google Cloud Translation Basic (người dùng chọn), không chặn lưu; manual edit được giữ khi đổi tên Việt và đánh dấu REVIEW. Retry là thao tác chủ động cho phép thay bản sửa tay bằng bản dịch mới.
- Hai ảnh độc lập tùy chọn: thumbnail và banner. Tái dùng Cloudinary, JPEG/PNG/WebP ≤5MB như upload sản phẩm, không ép crop/tỉ lệ ở BE. Không có ảnh trả null; cách hiển thị fallback do CMS/store quyết định.
- Ẩn cha ẩn nhánh, direct category URL/filtered products trả 404 khi category không hiển thị. Lọc cha gồm descendants hiển thị, bỏ các nhánh con ẩn. Sản phẩm vẫn xuất hiện ngoài bộ lọc category nếu thỏa quy tắc sản phẩm.
- Giữ sortOrder và move parent, không thêm batch drag reorder.

## API bổ sung

- GET categories và categories/:id: query locale vi|en, nội dung dịch và URL ảnh; không lộ khóa xử lý nền.
- POST/PATCH admin/categories: nameEn tùy chọn; null yêu cầu tự dịch; chuỗi không rỗng là sửa tay.
- POST admin/categories/:id/translation/retry: trả category PENDING, giữ bản Anh đang có đến khi dịch xong.
- POST admin/categories/:id/images/:slot/presign và PATCH cùng path bỏ /presign: slot thumbnail|banner; patch {storageKey} hoặc null để gỡ. Kiểm namespace, định dạng và dung lượng thật trước khi gắn.

## Nhất quán và vận hành

Category cũ được thêm nullable content và PENDING, giữ ids/slugs/parent/order/visibility. Worker polling chỉ bật khi có GOOGLE_TRANSLATE_API_KEY; đọc hàng đợi DB, lease có hạn, gọi HTTP ngoài transaction, conditional update theo version + lease để kết quả cũ không ghi đè. Lỗi đánh dấu FAILED; ADMIN retry. Rename tên Việt hủy bản dịch máy cũ; sửa tay chuyển MANUAL, đổi Việt sau đó chuyển REVIEW. Không tự dịch lại MANUAL/REVIEW khi khởi động. Backfill dùng chính các dòng PENDING theo batch nhỏ, có thể tắt bằng gỡ cấu hình. Không gọi dịch vụ thật trong test.

## Acceptance

1. Rename/move không đổi slug, locale không đổi URL identity.
2. Việt/Anh/manual/review/fallback/retry đúng contract; null/empty/locale sai được validate.
3. Worker không ghi đè sau rename/manual/retry/delete, khôi phục lease hết hạn, lỗi không chặn API ghi.
4. Ảnh đúng category và slot, kiểm file thực; gỡ ảnh null, quyền STAFF ghi bị chặn.
5. Hidden ancestors/descendants được xử lý nhất quán trên category và product filter; query không category giữ nguyên.
6. Prisma generate, lint, typecheck, unit, e2e, build và OpenAPI cập nhật; báo rõ kiểm tra nào thiếu điều kiện chạy.

## Trạng thái triển khai

Code và kiểm chứng BE hoàn tất tại working tree; xem [report](report.md). Tracker giữ in-progress tới khi có PR/merge theo quy ước repo.

## Ngoài phạm vi

Sửa ứng dụng CMS/store, cache invalidation xuyên ứng dụng, deploy, gọi dịch vụ có phí hoặc backfill DB môi trường thật. Không tự xoá object cũ khi thay ảnh vì có thể đang được request khác gắn lại; cần vận hành dọn object mồ côi riêng.

## Thiết kế đa ngôn ngữ đã chốt — chưa triển khai thay thế

Người dùng xác nhận “đồng ý” với luồng: nhập tên Việt một lần; tự dịch sang các ngôn ngữ cửa hàng được bật; CMS chỉ mở một bản dịch qua bộ chọn ngôn ngữ khi cần xem/sửa. Không yêu cầu nhập đồng thời nhiều ô. Khi tên gốc đổi, bản dịch đã sửa tay vẫn được giữ và đánh dấu cần rà soát.

Code hiện tại vẫn là bản Việt/Anh mô tả phía trên; các quyết định dưới đây là thiết kế cho lần mở rộng tiếp theo, chưa phải trạng thái code đã triển khai.

Người dùng tiếp tục xác nhận “đồng ý” cho cả hai câu hỏi về ngôn ngữ ban đầu và quản lý ngôn ngữ trong CMS:

- Dùng bảng `category_translations`, duy nhất theo `categoryId + locale`, thay vì thêm cột cho mỗi ngôn ngữ. Một category giữ cùng id/slug qua các ngôn ngữ.
- Ban đầu bật tiếng Việt và tiếng Anh; có thể mở rộng thêm ngôn ngữ.
- Admin bật/tắt ngôn ngữ trong CMS. Khi bật ngôn ngữ mới, dịch nền các category hiện có; chưa có bản dịch thì store fallback tên Việt.
- Khi tắt ngôn ngữ, giữ các bản dịch đã lưu để dùng lại sau.
- Nhập tên gốc tiếng Việt một lần. CMS dùng bộ chọn ngôn ngữ và một ô sửa bản dịch đang chọn; không dựng mười ô nhập bắt buộc cho mười ngôn ngữ.
- Giữ Google làm nhà cung cấp đã chọn; bản sửa tay được bảo vệ, đổi tên gốc đánh dấu cần rà soát. Không mở rộng dịch sang Product.

Phần triển khai cần chuyển dữ liệu Anh hiện có sang bảng bản dịch, bảo toàn override/trạng thái, và mở rộng lease/version/retry theo từng locale; bổ sung API cấu hình ngôn ngữ, cập nhật contract và kiểm thử migration tương thích. Kế hoạch thực hiện đã ghi tại [Giai đoạn B trong plan](plan.md#giai-đoạn-b--mở-rộng-đa-ngôn-ngữ-đã-thống-nhất-chưa-triển-khai). Chưa áp migration hay sửa code cho phần mở rộng trong phiên thảo luận này.
