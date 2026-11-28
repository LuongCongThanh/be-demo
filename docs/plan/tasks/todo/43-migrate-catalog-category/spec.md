---
status: todo
pr:
blocked-by:
  - 40-lint-boundary-generator
---

# Chuyển feature catalog/category sang kiến trúc chung

**Blocked by:** 40-lint-boundary-generator

**What to build:** Chuyển feature catalog/category sang kiến trúc chung: đưa module về bộ khung chung theo ADR 0015, giữ nguyên hành vi.

**Quyết định nguồn:** [Bản đồ chuyển đổi cho từng module](../../../initiatives/src-wide-architecture-standard/issues/02-layered-structure-criteria.md), [Chiến lược xử lý lỗi toàn src](../../../initiatives/src-wide-architecture-standard/issues/03-error-handling-strategy.md), [Hợp đồng transaction trong và giữa các module](../../../initiatives/src-wide-architecture-standard/issues/05-transaction-contract.md)

**Hình đích minh họa:** [cây toàn `src/modules`](../../../initiatives/src-wide-architecture-standard/assets/02-src-modules-target-tree.md), [cây `catalog`](../../../initiatives/src-wide-architecture-standard/assets/02-catalog-target-tree.md). Đây là minh họa; tên file chính xác chốt theo code lúc làm.

## Đọc trước khi làm (bắt buộc với mọi agent: Claude Code, Codex, Copilot)

1. Rule kiến trúc: [`.claude/rules/module-architecture.md`](../../../../../.claude/rules/module-architecture.md) và quyết định [ADR 0015](../../../../adr/0015-one-layered-architecture-for-every-module.md).
2. Map quyết định: [Chuẩn kiến trúc thống nhất cho toàn `src/modules`](../../../initiatives/src-wide-architecture-standard/map.md) và các ticket được link trong spec này. Ticket là nguồn quyết định; spec này không được mâu thuẫn với ticket.
3. **Đối chiếu code hiện tại trước khi sửa.** Nếu code khác với mô tả trong spec (file đã đổi tên, đã có người làm một phần...), dừng lại và hỏi người dùng, không tự suy diễn.
4. Quy trình Git của repo: branch từ `dev`, Conventional Commit, PR vào `dev`, squash merge. **Không** ghi attribution AI/agent trong commit hay PR.

## Ràng buộc chung (refactor thuần, không đổi hành vi)

- **Không đổi** route, HTTP method, status code, response shape, message lỗi, Swagger. Không đổi schema Prisma hay migration.
- Không trộn sửa bug hay tính năng mới vào PR này. Thấy bug thì ghi vào `report.md`, không sửa.
- Mỗi file ≤ 200 dòng (không tính dòng trống, comment), mục tiêu ~150. Vượt thì tách theo trách nhiệm.
- Không tạo thư mục rỗng; không tạo interface/port/mapper khi không có nhu cầu thật.
- Không dùng barrel `index.ts`; import bằng alias `#src/...js`, không import tương đối.
- Test: E2E giữ nguyên và phải xanh. Unit test hỏng vì service không còn dùng `PrismaService` thì **sửa tối thiểu**: thay mock Prisma bằng repository giả (object cài đặt abstract class port). Không viết test mới (test phase làm sau), không xoá/skip test.

## Việc cần làm

1. Gom `admin/application/*` và `storefront/application/*` (và `application/shared/*`) về `category/application/` (không lặp `application/` trong bề mặt; bỏ `application/shared/`). `admin/` và `storefront/` chỉ còn `controllers/`, `dto/`, `mappers/`.
2. Đổi 6 token `Symbol` + `interface` + `@Inject(TOKEN)` sang `abstract class` làm token; bind bằng `useExisting` trong `category-core.module.ts`. Giữ tách Core/Admin/Storefront Nest module.
3. Bỏ cách `transaction(work: (tx: CategoryPersistenceOperations) => ...)` trong port; adapter dùng `txHost.tx`, service dùng `TransactionRunner.run()`. Giữ nguyên thứ tự thao tác và điều kiện revision/generation của translation.
4. Port `CategoryImageStorage`: nếu chỉ bọc lại Cloudinary thì bỏ, dùng port Storage dùng chung (`src/infrastructure/storage/storage.port.ts`); nếu có hành vi riêng thật (slot key...) thì giữ phần riêng đó trong `domain/` hoặc một adapter mỏng gọi port chung. Ghi lý do vào `report.md`.
5. Xoá `presentation/category-error-mapping.interceptor.ts` (+ spec) và chỗ đăng ký; `domain/errors/category-errors.ts` kế thừa lỗi chung (`CategoryNotFoundError extends NotFoundError`, `CategorySlugConflictError extends ConflictError`, ...). Service đang ném `NotFoundException`/`BadRequestException` (`storefront/.../category.service.ts`, `admin/.../admin-category-image.service.ts`, `application/shared/localization/category-language.service.ts`) đổi sang lỗi chung, giữ message.
6. Hai adapter `prisma-category.repository.ts` (275 dòng) và `prisma-category-translation.persistence.ts` (261 dòng) và `admin-category.service.ts` (214 dòng) tách để ≤ 200 dòng.
7. Chuyển `application/shared/localization/category-language-race.spec.ts` (thực chất là integration test dùng adapter Prisma) sang cạnh adapter trong `infrastructure/` hoặc vào `test/`; giữ nguyên nội dung kiểm tra.
8. Cập nhật `docs/architecture/modules/catalog.md` và `src/modules/catalog/README.md`.

## Tiêu chí nghiệm thu chung

- [ ] `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` đều đạt.
- [ ] Swagger không đổi: `npm run openapi:write` rồi `git diff --exit-code docs/openapi/openapi.json` không có khác biệt.
- [ ] Trong `src/modules/catalog/category/`: chỉ file trong `infrastructure/` import `PrismaService`, `#src/generated/**` hay `@nestjs-cls/**`. Kiểm bằng `grep -rnE "PrismaService|#src/generated|@nestjs-cls" <thư mục module> | grep -v /infrastructure/` → rỗng.
- [ ] `domain/` và `application/` không import HTTP exception của `@nestjs/common`; chỉ ném lỗi từ `src/common/errors/`.
- [ ] Module được thêm vào danh sách module đã chuyển đổi của `scripts/generate-oxlint-boundaries.ts` (chạy lại script, `oxlint.json` cập nhật) và vào mục **Migrated modules** của `.claude/rules/module-architecture.md` (`catalog/category`); chạy `npm run agents:check` đạt.
- [ ] Tài liệu mô tả cây/đường dẫn được cập nhật trong cùng PR (`docs/architecture/02-modules.md` §4, `docs/architecture/modules/*.md` liên quan, `src/**/README.md`); `grep` các đường dẫn cũ trong `docs/` và `src/**/README.md` → rỗng.
- [ ] File vừa tách khỏi danh sách tạm `max-lines` (nếu có) được xoá khỏi danh sách đó.
- [ ] `report.md` ghi: số file trước/sau, các khác biệt so với spec, bug phát hiện nhưng không sửa.
