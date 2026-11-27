---
status: todo
pr:
blocked-by:
  - 38-architecture-standard-docs
---

# Nền móng dùng chung cho kiến trúc mới

**Blocked by:** 38-architecture-standard-docs

**Status:** ready-for-agent

**What to build:** Các thành phần dùng chung mà mọi module cần trước khi chuyển đổi: bộ lỗi nghiệp vụ, `TransactionRunner`, port dùng chung cho Idempotency/Mail/Storage/Audit. **Chưa chuyển module nghiệp vụ nào**; hành vi app không đổi.

**Quyết định nguồn:** [Chiến lược xử lý lỗi toàn src](../../wayfinding/src-wide-architecture-standard/issues/03-error-handling-strategy.md), [Hợp đồng transaction trong và giữa các module](../../wayfinding/src-wide-architecture-standard/issues/05-transaction-contract.md), [Thư viện transaction có chạy với NestJS 12 và Prisma 7 không](../../wayfinding/src-wide-architecture-standard/issues/11-nestjs-cls-transactional-compatibility.md) (đọc cả [research](../../wayfinding/src-wide-architecture-standard/research/11-nestjs-cls-transactional-compatibility.md) mục 4 "Wiring chạy được"), [Bản đồ chuyển đổi cho từng module](../../wayfinding/src-wide-architecture-standard/issues/02-layered-structure-criteria.md) quy tắc 3, [Cách tách checkout](../../wayfinding/src-wide-architecture-standard/issues/07-checkout-structure.md) mục 2.

## Đọc trước khi làm (bắt buộc với mọi agent: Claude Code, Codex, Copilot)

1. Rule kiến trúc: [`.claude/rules/module-architecture.md`](../../../../.claude/rules/module-architecture.md) và quyết định [ADR 0015](../../../adr/0015-one-layered-architecture-for-every-module.md).
2. Map quyết định: [Chuẩn kiến trúc thống nhất cho toàn `src/modules`](../../wayfinding/src-wide-architecture-standard/map.md) và các ticket được link trong spec này. Ticket là nguồn quyết định; spec này không được mâu thuẫn với ticket.
3. **Đối chiếu code hiện tại trước khi sửa.** Nếu code khác với mô tả trong spec (file đã đổi tên, đã có người làm một phần...), dừng lại và hỏi người dùng, không tự suy diễn.
4. Quy trình Git của repo: branch từ `dev`, Conventional Commit, PR vào `dev`, squash merge. **Không** ghi attribution AI/agent trong commit hay PR.

## Việc cần làm

1. **Bộ lỗi chung** `src/common/errors/business-errors.ts`: lớp gốc `BusinessError` (abstract, kế thừa `Error`, đặt `name`) và 6 lớp con `NotFoundError` (404), `ConflictError` (409), `InvalidInputError` (400), `UnprocessableError` (422), `UnauthenticatedError` (401), `ForbiddenError` (403). Không import NestJS (common không phụ thuộc framework HTTP).
2. **`AllExceptionsFilter`** (`src/http/filters/all-exceptions.filter.ts`): đổi `BusinessError` sang đúng status, `message` giữ nguyên, shape `{ statusCode, message, requestId }` giữ nguyên, log level như lỗi 4xx hiện tại. Giữ nguyên xử lý `HttpException` và Prisma error.
3. **Transaction:**
   - Cài `nestjs-cls`, `@nestjs-cls/transactional`, `@nestjs-cls/transactional-adapter-prisma` (bản đã kiểm: 7.0.2 / 4.0.2 / 2.0.2 hoặc mới hơn cùng major).
   - Đăng ký `ClsModule` với `ClsPluginTransactional` + `TransactionalAdapterPrisma<PrismaService>` (ghi rõ generic vì client sinh ở `src/generated/prisma`). Đặt middleware của Cls **trước** request-id middleware như bản đã kiểm; nếu đổi thứ tự thì kiểm lại `requestId` trong log.
   - Port `src/infrastructure/database/transaction-runner.port.ts`: `export abstract class TransactionRunner { abstract run<T>(work: () => Promise<T>, opts?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number; maxWait?: number }): Promise<T>; }` (import kiểu Prisma ở đây được phép).
   - Adapter `src/infrastructure/database/cls-transaction-runner.ts` dùng `TransactionHost.withTransaction` (truyền `opts` vào đó; propagation mặc định Required = lồng nhau nhập vào giao dịch ngoài). Bind `{ provide: TransactionRunner, useExisting: ClsTransactionRunner }` trong module database, export ra toàn app.
   - Cung cấp cách để adapter Prisma lấy client hiện hành: inject `TransactionHost<TransactionalAdapterPrisma<PrismaService>>` và dùng `txHost.tx` (tự là client thường khi không có giao dịch). Chỉ code trong `infrastructure/` được dùng.
4. **Port dùng chung** (abstract class, cạnh code hạ tầng, class hiện có trở thành adapter cài đặt port):
   - `src/infrastructure/mail/mail.port.ts` (theo các method `MailService` đang được gọi).
   - `src/infrastructure/storage/storage.port.ts` (theo các method `CloudinaryClient` đang được product và Category gọi; đọc cả `category-image.storage.ts` để gộp nhu cầu).
   - `src/infrastructure/audit/audit-log.port.ts` (theo `AuditLogService`).
   - `src/infrastructure/idempotency/idempotency.port.ts` + adapter Prisma trên bảng `idempotency_keys`: `find(scope, key)`, `start(scope, key, requestHash): Promise<boolean>`, `complete(scope, key, status, response)`; adapter dùng `txHost.tx` để tham gia giao dịch. Chưa đổi checkout dùng nó (để task 46).
   - Chỉ khai báo method đang thật sự được dùng.
5. **Kiểm DI trong vitest:** viết một unit test nhỏ (được phép, vì là kiểm hạ tầng mới) dựng `Test.createTestingModule` inject port abstract class và `TransactionRunner`, chạy commit/rollback bằng giả lập hoặc DB test. Nếu vitest không có decorator metadata thì thêm `unplugin-swc` vào `vitest.config.ts` và `vitest.config.e2e.ts`; ghi kết quả vào `report.md`.

## Ràng buộc

- Không đổi bất kỳ service nghiệp vụ nào sang dùng các thành phần mới (để các task chuyển module làm).
- Không đổi response, route, Swagger. Swagger diff phải rỗng.
- Mỗi file ≤ 200 dòng.

## Tiêu chí nghiệm thu

- [ ] `npm run build`, `typecheck`, `lint`, `test`, `test:e2e` đạt; Swagger diff rỗng.
- [ ] Ném thử từng lớp trong bộ lỗi chung qua filter cho đúng status/message (test nhỏ hoặc e2e tạm trong PR).
- [ ] `TransactionRunner.run()` commit, rollback khi throw, và lồng nhau dùng chung giao dịch (test nhỏ).
- [ ] Test xác nhận `opts.isolationLevel` (và `timeout`) được áp dụng cho giao dịch ngoài cùng.
- [ ] `requestId` vẫn đúng trong log và response lỗi khi có request đồng thời.
- [ ] Ghi chú trong `.claude/rules/module-architecture.md` rằng `src/common/errors/` và `TransactionRunner` đã có; `npm run agents:check` đạt.
- [ ] `report.md`: phiên bản thư viện, có cần SWC không, chữ ký từng port.
