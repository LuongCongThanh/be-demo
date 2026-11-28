---
status: done
pr: #141
blocked-by: []
---

# Viết tài liệu chuẩn kiến trúc module

**Blocked by:** —

**What to build:** Bộ tài liệu chuẩn duy nhất trong `docs/convention/` mô tả kiến trúc chung cho mọi module (ADR 0015), thay cho hai tài liệu Category v1.6, và gỡ mọi mâu thuẫn trong các tài liệu hiện có. **Chỉ sửa tài liệu**, không sửa code `src/`.

**Quyết định nguồn:** [Bộ tài liệu chuẩn cho toàn src](../../../wayfinding/src-wide-architecture-standard/issues/01-canonical-standard-documents.md) (kể cả hai mục Bổ sung), [Bản đồ chuyển đổi cho từng module](../../../wayfinding/src-wide-architecture-standard/issues/02-layered-structure-criteria.md), [Chiến lược xử lý lỗi toàn src](../../../wayfinding/src-wide-architecture-standard/issues/03-error-handling-strategy.md), [Hợp đồng transaction trong và giữa các module](../../../wayfinding/src-wide-architecture-standard/issues/05-transaction-contract.md), [Ownership dữ liệu cho cart và checkout](../../../wayfinding/src-wide-architecture-standard/issues/06-cart-checkout-ownership.md), [Bộ luật lint bắt buộc và lộ trình bật](../../../wayfinding/src-wide-architecture-standard/issues/08-lint-boundary-rules.md).

## Đọc trước khi làm (bắt buộc với mọi agent: Claude Code, Codex, Copilot)

1. Rule kiến trúc: [`.claude/rules/module-architecture.md`](../../../../../.claude/rules/module-architecture.md) và quyết định [ADR 0015](../../../../adr/0015-one-layered-architecture-for-every-module.md).
2. Map quyết định: [Chuẩn kiến trúc thống nhất cho toàn `src/modules`](../../../wayfinding/src-wide-architecture-standard/map.md) và các ticket được link trong spec này. Ticket là nguồn quyết định; spec này không được mâu thuẫn với ticket.
3. **Đối chiếu code hiện tại trước khi sửa.** Nếu code khác với mô tả trong spec (file đã đổi tên, đã có người làm một phần...), dừng lại và hỏi người dùng, không tự suy diễn.
4. Quy trình Git của repo: branch từ `dev`, Conventional Commit, PR vào `dev`, squash merge. **Không** ghi attribution AI/agent trong commit hay PR.

## Việc cần làm

1. Tạo `docs/convention/module-architecture-conventions.md` (tiếng Việt, thuật ngữ kỹ thuật giữ tiếng Anh) gồm:
   - Bộ khung thư mục A': `domain/`, `application/` (+ `ports/`), `infrastructure/`, `presentation/`, `admin/` (= bề mặt Back-office, không phải Vai trò Admin), `storefront/`, `<module>.module.ts`. Viết dạng **bảng tên thư mục + vai trò**, **không vẽ cây cụ thể** của module thật; trỏ sang `src/modules/catalog/category/` làm ví dụ.
   - 4 dạng dữ liệu (Domain Model `type` thuần, Application Result, Persistence Record chỉ ở `infrastructure/`, DTO chỉ ở bề mặt).
   - Port: một Persistence Port mỗi feature, `abstract class` làm token, port dùng chung cho Mail/Storage/Audit/Idempotency ở `src/infrastructure/**/*.port.ts`, port riêng cho I/O của module, không port cho thư viện thuần.
   - Lỗi: bộ lỗi chung `src/common/errors/`, filter đổi sang HTTP, tầng HTTP vẫn dùng exception NestJS.
   - Transaction: `TransactionRunner.run()`, adapter tự nhập giao dịch, không `tx` qua port, không `@Transactional()` ở service, lồng nhau nhập vào giao dịch ngoài, không gọi ra ngoài trong giao dịch, khoá dòng ở module chủ qua `{ lockForUpdate: true }`.
   - Ranh giới module/feature, class công khai duy nhất `application/<module>.service.ts`, chiều gọi một chiều (lấy nguyên từ ticket 06).
   - Giới hạn 150/200 dòng và các miễn trừ.
   - Danh sách 7 luật lint (ticket 08).
2. Đưa phần riêng của doc 02 v1.6 (TypeScript, async, concurrency, logging, bảo mật, checklist review PR, Definition of Done) vào file convention phù hợp hoặc một file `docs/convention/code-quality-conventions.md`; bỏ phần lặp với `api-rules.md`, `error-logging-conventions.md`, `coding-style-conventions.md`.
3. **Xoá** hai file `01-category-folder-structure-convention-v1.6.md` và `02-category-clean-code-quality-convention-v1.6.md` trong `docs/architecture/refactor/`; sửa mọi link trỏ tới chúng (`grep -rn "refactor/0[12]-category" docs src .claude .github AGENTS.md` → rỗng).
4. Bỏ mọi câu "Category là ngoại lệ" trong `docs/convention/README.md`, `coding-style-conventions.md` §2.1–§2.3, `api-rules.md` R2/R3/R6/R7, `prisma-conventions.md` §4; thay bố cục `controllers/admin`, `services/storefront` ở coding-style §2.2 bằng bộ khung A'. Sửa R7 ("trả thẳng Prisma type"): không còn hợp lệ. Sửa câu ngưỡng dòng trong `02-modules.md` và coding-style.
5. Sửa `docs/architecture/02-modules.md` §2 đoạn cuối và `docs/architecture/04-data-consistency.md`: bỏ "truyền `Prisma.TransactionClient`", thay bằng `TransactionRunner`.
6. Thêm `module-architecture-conventions.md` vào bảng thứ tự đọc của `docs/convention/README.md`.
7. Đổi dẫn chiếu trong `.claude/rules/module-architecture.md` sang tài liệu mới (giữ mục Migration status), chạy `npm run agents:check`.

## Tiêu chí nghiệm thu

- [ ] Một chủ đề chỉ có một nguồn chuẩn; không còn câu nào nói Category là ngoại lệ hay "không cần Repository" mà không dẫn chiếu kiến trúc mới.
- [ ] Không file nào link tới hai doc v1.6 đã xoá.
- [ ] Nội dung khớp từng quyết định trong các ticket nguồn; chỗ nào phải diễn giải thêm thì ghi vào `report.md`.
- [ ] `npm run agents:check` và `npm run format:check` đạt (với file markdown đã sửa).
- [ ] Không sửa file trong `src/` ngoài `src/**/README.md` nếu cần cập nhật link.
