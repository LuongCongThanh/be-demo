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

- `npm run lint`: pass; còn một warning `no-explicit-any` tại
  `src/modules/identity/auth/guards/email-throttler.guard.ts`.
- `npm run typecheck`: pass.
- `npm run test`: 275 tests pass across 37 files.
- `npm run test:e2e`: 190 tests pass, 1 skipped, across 25 passing files and
  1 skipped file; run against an isolated PostgreSQL 17 database.
- `npm run build`: pass.
- `npm run openapi:write`: pass; generated
  `docs/openapi/openapi.json` matches the committed contract.
- Provider/storage trong test đều fake; không gọi Google hoặc Cloudinary thật.

## Giới hạn chưa nghiệm thu

- Credential Google Translation thật và deploy rollout không được kích hoạt.
- Không sửa CMS/store UI; tài liệu bàn giao mô tả contract và cache locale.
- Theo dõi triển khai trong PR [#98](https://github.com/LuongCongThanh/be-demo/pull/98).
