# Báo cáo: Viết tài liệu chuẩn kiến trúc module

## Đã thay đổi

- Tạo `docs/convention/module-architecture-conventions.md`: bộ khung A' dạng bảng, 4 dạng dữ liệu, Port/DI, lỗi chung, `TransactionRunner`, ranh giới module/feature, giới hạn 150/200 dòng, 7 luật lint và lộ trình bật.
- Tạo `docs/convention/code-quality-conventions.md`: phần riêng của doc 02 v1.6 (nguyên tắc, TypeScript, async, concurrency, bảo mật, API tương thích ngược, kiểm thử, checklist review PR, Definition of Done). Phần trùng với `api-rules.md`, `error-logging-conventions.md`, `coding-style-conventions.md` chỉ dẫn chiếu.
- Xoá hai doc Category v1.6 trong `docs/architecture/refactor/`; sửa mọi link (kể cả các tài liệu wayfinding lịch sử và `src/modules/catalog/README.md`). `grep -rn "refactor/0[12]-category" docs src .claude .github AGENTS.md` rỗng.
- Bỏ các câu "Category là ngoại lệ" ở `docs/convention/README.md`, `coding-style-conventions.md` §2.1–§2.3, §2.6 và §7, `api-rules.md` R2/R3/R4/R6/R7/R10, `prisma-conventions.md` đầu file/§4/§4.1, `error-logging-conventions.md` §1/§5, `api-crud-walkthrough.md` đầu file.
- `docs/architecture/02-modules.md` (§2 đoạn cuối, §3, §3.1, §4 đoạn Category, comment cây) và `04-data-consistency.md` §1: `TransactionRunner` thay cho `Prisma.TransactionClient`.
- `docs/convention/README.md`: thêm hai file mới vào bảng thứ tự đọc (đánh lại số thứ tự).
- `.claude/rules/module-architecture.md`: đổi dẫn chiếu sang tài liệu mới; giữ nguyên Migration status. `npm run agents:check` đạt.

## Chỗ phải diễn giải thêm ngoài ticket

1. `04-data-consistency.md` không hề chứa câu "truyền `Prisma.TransactionClient`" (chỉ `02-modules.md` §2 có). Tôi thêm một gạch đầu dòng ở §1 nêu cách mở giao dịch mới thay vì xoá một câu không tồn tại.
2. Thư mục `testing/` (helper test dùng chung, đang có ở Category) không nằm trong bộ khung A' của ticket. Tôi ghi nó như quy ước phụ ở §2 của file chuẩn, không đưa vào bảng khung.
3. Tên file port: `<tên>.repository.ts` cho Persistence Port, `<tên>.port.ts` cho port I/O khác, adapter `prisma-<tên>.repository.ts` (suy từ rule agent và code Category); ticket chưa nêu.
4. `docs/agents/workspace.md` (quy trình Contract Version) không có trong repo này nên không link; phần API contract ở code-quality dẫn tới `03-api.md`.
5. Các câu chuyển tiếp trong `.claude/rules/prisma-schema.md`, `api-conventions.md`, `error-logging.md`, `coding-style.md` được để nguyên: ticket 09 giao việc gỡ chúng cho task 49 (khi mọi module đã chuyển đổi).
6. Tài liệu chuẩn mô tả kiến trúc đích cho mọi module nhưng code chưa có `src/common/errors/`, `TransactionRunner`, port dùng chung, script sinh luật lint (task 39–40). Mỗi file đều có câu dẫn tới mục Migration status để người đọc biết module chưa chuyển đổi giữ cấu trúc cũ.
7. Tôi sửa `spec.md` của chính task 38 (đổi chuỗi đường dẫn đầy đủ của hai doc đã xoá sang tên file ngắn) vì nếu không `grep` nghiệm thu không bao giờ rỗng.

## Mâu thuẫn/việc chưa sửa (ngoài phạm vi)

- `api-crud-walkthrough.md`: code mẫu service/test vẫn gọi `PrismaService` và ném `NotFoundException`. Đã thêm ghi chú đầu file, chưa viết lại mẫu; nên giao cho task chuyển module hoặc task 49.
- `docs/architecture/02-modules.md` §4.1/§4.2 vẫn vẽ cây cũ (`controllers/storefront`, `services/...`) và liệt kê "mỗi module export đúng một service public" kèm `CartService`...; cây đích sẽ đúng khi từng module được chuyển (quy tắc cập nhật cùng PR).
- `npm run format:check` toàn repo báo 7 file `.ts` trong `src/` (ví dụ `cart.controller.ts`) lệch format từ trước, không thuộc task này; tất cả markdown đã sửa đều đạt `prettier --check`.
