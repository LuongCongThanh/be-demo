# Implementation report — Bật/tắt ngôn ngữ và tự dịch category

## Kết quả

- Dùng chung PostgreSQL transaction advisory lock khi tạo category và bật/tắt locale; locale được đọc trong transaction tạo category để không bỏ sót category trong race.
- Giữ backfill bền vững qua `CategoryTranslation` rows; worker xử lý batch tối đa 10 và kiểm tra locale generation trước khi claim/commit.
- Bổ sung HTTP/E2E coverage cho ba locale với fake provider: permission, validation, fallback, race enable/create, disable/re-enable, giữ MANUAL/REVIEW, đổi tên nguồn và worker instance mới.
- Cập nhật [hướng dẫn tích hợp](../guide.md) và contract OpenAPI.

## Kiểm chứng

- `npm test`: 37 files, 275 tests pass.
- `npm run typecheck`, `npm run lint`, `npm run build`: pass. Lint giữ nguyên warning `no-explicit-any` ngoài phạm vi tại `email-throttler.guard.ts`.
- GitHub Actions trên [PR #96](https://github.com/LuongCongThanh/be-demo/pull/96), run [44794397871](https://github.com/LuongCongThanh/be-demo/actions/runs/44794397871): build, docs-links, E2E, lint, OpenAPI contract, typecheck và unit test đều pass.
- E2E local không chạy vì `.env` trỏ tới database chưa được xác nhận là test-only; CI chạy trên PostgreSQL test DB riêng.
