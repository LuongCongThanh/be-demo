# Ticket 03 — kết quả local (2026-11-21)

## Hành vi hoàn tất

- Bổ sung DTO/Swagger cho `PATCH` bản dịch theo locale: bắt buộc có `name`,
  trim chuỗi, chặn chuỗi rỗng; `null` yêu cầu dịch lại.
- `GET /admin/categories/:id/translations` trả locale/name/status/updatedAt
  cho CMS, không lộ lease/revision/source/generation.
- `PATCH` và `POST .../translations/:locale/retry` dùng chung advisory lock
  locale/category, row-lock category, validate locale đang bật và không cho
  override `vi`.
- Edit/retry conditional theo `(categoryId, locale)`, revision, source version
  và enable generation; kết quả worker cũ không ghi đè sau edit/rename/retry,
  disable hoặc delete.
- Contract compatibility cũ `nameEn` và retry English tiếp tục chiếu đúng dòng
  `en`; category creation cũng ghi enable generation cho mọi locale được bật.
- Hướng dẫn CMS/store và tài liệu module/tracker ticket được cập nhật.

## Kiểm chứng

- Unit focused: `27/27` test `AdminCategoryService` pass.
- Toàn bộ unit suite trước sửa: `275/275` pass. Sau các thay đổi cuối, focused
  service suite và category PostgreSQL E2E được chạy lại riêng.
- Category E2E trên PostgreSQL 17 Docker cô lập: `14/14` pass, gồm ba locale,
  quyền, validation, 404, independence, legacy English, rename/review/retry,
  disable/re-enable và race worker nhiều instance/edit/delete.
- Provider/storage trong test đều fake; không gọi Google hoặc Cloudinary thật.
- Còn phải chạy lại unit/type/lint/build/OpenAPI sau bước báo cáo cuối này.

## Giới hạn chưa nghiệm thu

- Credential Google Translation thật và deploy rollout không được kích hoạt.
- Không sửa CMS/store UI; tài liệu bàn giao mô tả contract và cache locale.
- Không PR/push theo quy trình local hiện tại.
