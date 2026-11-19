# Báo cáo triển khai BE category — 2026-11-19

## Kết quả

Đã triển khai tại working tree: slug ổn định; tên Việt/Anh và locale/fallback; Google translation adapter + durable worker trên category row; editorial override/review/retry; hai slot ảnh qua Cloudinary; visibility cho bộ lọc category; serialization chống cycle do move đồng thời; migration additive và OpenAPI mới.

Bản dịch không chặn lưu, không cần Redis/queue service mới. Kết quả dịch chỉ ghi khi version/status/lease còn khớp. Manual/REVIEW không tự backfill. Public response không lộ lease/version/storage keys; admin response có trạng thái và keys phục vụ quản trị. Không tạo taxonomy mới hay sửa Product translation.

## Kiểm chứng

- `prisma generate` và `prisma format --config prisma7.config.ts`: pass.
- `npm run typecheck`, `npm run openapi:write` (gồm Nest build): pass.
- `npm test`: 36 file, 271 test pass.
- `npm run test:e2e`: 20 file pass, 185 test pass; 1 file/test SMTP thật skipped theo cấu hình opt-in sẵn có.
- E2E chạy trên PostgreSQL 17 trong container tạm độc lập, apply toàn bộ 17 migration + seed; đã dọn container sau test. DB local cấu hình port 5433 không hoạt động nên không sử dụng hay thay đổi DB đó.
- HTTP category/product tests xác minh locale/manual/review/fallback/retry, validation, permission, slot ảnh, move đối nghịch đồng thời, descendants hiển thị, hidden ancestors và global search.
- Integration test dùng PostgreSQL thật cho claim/complete và sửa dữ liệu trong lúc provider chờ: rename/manual/retry/delete đều không bị kết quả cũ ghi đè; successful translation lưu và phục vụ locale Anh.
- Unit tests provider/storage dùng fake HTTP/storage, có nhánh lỗi và invalid content; không gọi Google/Cloudinary thật.
- Lint exit 0, có warning `no-explicit-any` đã có ở `email-throttler.guard.ts` ngoài phạm vi category. Format các file TS thay đổi và `git diff --check`: pass.

## Bàn giao và giới hạn

- [Spec](spec.md), [plan](plan.md), [hướng dẫn API và rollout](guide.md); contract ở `docs/openapi/openapi.json`.
- Chưa apply migration môi trường người dùng, chưa bật dịch có phí, chưa có credential Google thật và chưa deploy. Cần migrate deploy trước khi chạy BE mới, sau đó cấu hình GOOGLE_TRANSLATE_API_KEY nếu muốn bật worker. Không có key vẫn dùng tên Việt/nhập Anh thủ công được.
- Chưa gọi Google/Cloudinary thật để nghiệm thu credential/chất lượng dịch/upload. Retry FAILED là chủ động; worker cần tiến trình BE hoạt động.
- CMS/store cần regenerate client và tích hợp locale/media/trạng thái dịch; UI/caching xuyên ứng dụng chưa nằm trong nghiệm thu BE này.
- Ảnh tháo/thay không xóa object cũ ngay để tránh race với request gắn lại; dọn object mồ côi là việc vận hành riêng.
- Không tạo PR/merge theo yêu cầu phiên này; task giữ in-progress trong tracker theo quy ước chỉ done sau merge. Không thay các chỉnh sửa có sẵn của người dùng ở tài liệu module/layout.
