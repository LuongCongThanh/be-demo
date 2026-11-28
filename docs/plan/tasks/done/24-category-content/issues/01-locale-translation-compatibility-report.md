# Ticket 01 — kết quả local (2026-11-19)

Triển khai tại branch `feature/category-locale-compat`, dựa trên integration baseline
`b838c94`. Commit triển khai: `f3b7ca7` (`feat(catalog): migrate English category content to locale translations`).
Đã merge tip `integration/category-multilingual` trước bàn giao (already up to date).
Không push, không PR theo workflow local đã được cho phép; trường `pr` để trống.
Task cha vẫn in-progress, các ticket ngôn ngữ/editorial tiếp tục theo dependency.

## Hành vi hoàn tất

- Migration additive tạo PK `(category_id, locale)`, sao chép tên/trạng thái Anh của
  mọi category (PENDING/null, TRANSLATED, MANUAL, REVIEW, FAILED), giữ version cũ
  làm revision và bỏ lease cũ. Giữ id/slug/tên Việt/parent/order/visibility/media.
- Tên Việt là nguồn với `sourceVersion`; revision/lease thuộc từng bản dịch.
  Create/update/retry và worker ghi bảng mới; các cột legacy giữ nguyên nhưng
  không dùng làm nguồn đọc/ghi độc lập.
- `nameEn`/`translationStatus` của admin và store tiếp tục contract cũ dưới dạng
  projection `en`, gồm cả response gắn ảnh. Slug, fallback, manual/review và retry
  giữ nguyên. Seed tạo dòng dịch idempotent, không xóa chỉnh sửa hiện có.
- Worker không chặn API, chỉ dịch `en` PENDING, bảo vệ bằng sourceVersion + revision
  - lease. Không commit kết quả cũ sau rename/manual/retry/delete; thiếu key giữ
    pending, lỗi provider chuyển FAILED. Không gọi provider/storage thật trong test.
- OpenAPI, schema/module docs và hướng dẫn rollout cập nhật. Bắt buộc dừng writer
  cũ trước migration; không rollback bằng BE cũ sau khi bảng legacy ngừng cập nhật.

## Kiểm chứng

TDD tại seams đã thống nhất: migration PostgreSQL; HTTP với PostgreSQL; unit adapter/service hiện có.
Đã ghi nhận red → green cho migration thiếu, projection legacy bị poison, và worker
cần ghi bảng mới trước khi triển khai tương ứng.

- `prisma format`, `prisma generate --config prisma7.config.ts`: pass; client sinh
  riêng trong worktree, chỉ node_modules được symlink.
- Apply sạch toàn bộ 18 migration + seed trên PostgreSQL 17 Docker tạm: pass.
- `prisma migrate diff --config prisma7.config.ts --from-config-datasource --to-schema prisma/schema --exit-code`: pass, no difference.
- `npm test`: 36 files / 271 tests pass.
- `npm run test:e2e`: 21 files / 187 tests pass; 1 file / 1 test SMTP thật skipped
  theo opt-in sẵn có. Bao gồm 30 HTTP category tests và migration fixture đủ 5 trạng thái.
- `npm run lint`: pass; warning `no-explicit-any` có sẵn tại email-throttler.guard.ts.
- `npm run typecheck`, `npm run openapi:write` (gồm Nest build), `git diff --check`: pass.
- Migration test chạy các migration Giai đoạn A trong schema tạm, tạo fixtures cũ,
  áp migration mới và xác minh parent/identity/media/names/status/revision/lease cùng
  uniqueness của locale. HTTP test cố ý thay cột retired để chứng minh responses
  chỉ đọc bảng mới; worker race tests dùng conditional writes PostgreSQL thật.

Chỉ dùng container PostgreSQL cô lập, không thay DB có sẵn, không deploy hay bật key.
API quản lý ngôn ngữ, backfill locale mới và editorial per-locale thuộc ticket sau.
