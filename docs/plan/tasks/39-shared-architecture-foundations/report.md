# Report: task 39, nền móng dùng chung

## Phiên bản thư viện

`nestjs-cls` 7.0.2, `@nestjs-cls/transactional` 4.0.2, `@nestjs-cls/transactional-adapter-prisma` 2.0.2 (chạy với Nest 12.0.1, Prisma 7.10.0, vitest 5.1.0).

## Có cần SWC không

Không. Vitest 5 dựng được DI kiểu constructor (`ConfigService`...) mà không có `unplugin-swc`; đã thử thêm rồi gỡ, `vitest.config*.ts` không đổi. Vẫn dùng `@Inject(TransactionHost)` tường minh trong adapter cho chắc.

## Chữ ký các port

- `TransactionRunner.run<T>(work: () => Promise<T>, opts?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number; maxWait?: number }): Promise<T>`. Adapter `ClsTransactionRunner` (qua `TransactionHost.withTransaction`, propagation Required). Bind trong `PrismaModule` (global).
- `MailSender` (`mail.port.ts`): `sendVerificationEmail(to, code)`, `sendPasswordResetEmail(to, rawToken)`. Adapter: `MailService`.
- `ImageStorage` (`storage.port.ts`): `publicUrl(key): string | null`, `signUpload(key, allowedFormats): SignedUpload`, `findImage(key): Promise<StoredImage | null>`, `destroy(key): Promise<void>`. Adapter: `CloudinaryClient`; `SignedUpload`/`StoredImage` chuyển sang port. Gộp đủ nhu cầu của `category-image.storage.ts` (3 method đầu) và product (`destroy`).
- `AuditLog` (`audit-log.port.ts`): `record(entry: AuditEntry): Promise<void>` (không có `tx`, `before`/`after` dùng `AuditJson` trung lập). Adapter: `AuditLogService`.
- `IdempotencyStore` (`idempotency.port.ts`): `find(scope, key): Promise<IdempotencyRecord | null>`, `start(scope, key, requestHash): Promise<boolean>` (`true` = lần gọi này tạo khoá; `ON CONFLICT DO NOTHING`), `complete(scope, key, status, response: IdempotencyJson): Promise<void>`. Adapter `PrismaIdempotencyStore` (dùng `txHost.tx`), `IdempotencyModule`.

Tên class port do task này chọn (spec chỉ cố định tên file).

## Diễn giải

1. `AuditLogService.record` hiện nhận `tx` làm tham số đầu, còn port không có `tx` (conventions §4). Không được đổi service nghiệp vụ, nên adapter có overload: `record(entry)` (port, dùng `txHost.tx`) và `record(tx, entry)` (cũ, giữ nguyên hành vi). Task chuyển module bỏ overload cũ.
2. `start` không ném P2002 khi trùng `(scope, key)` mà trả `false` (xem "Sửa theo code review"); checkout (task 46) `find()` rồi quyết replay/409.
3. `ClsModule` cấu hình qua `createClsModule` (`src/infrastructure/database/cls.config.ts`), dùng chung App và CLI. Không dựa vào thứ tự mount của middleware Cls so với `RequestIdMiddleware`: hai `AsyncLocalStorage` độc lập nên thứ tự không ảnh hưởng tính đúng; e2e 8 request song song xác nhận `requestId` đúng ở response lỗi.
4. `TransactionRunner` nhận `opts` chỉ ảnh hưởng giao dịch ngoài cùng; `run()` lồng nhau bỏ qua `opts`.
5. Port Mail/Storage/Audit được bind cạnh class cũ trong module hạ tầng; class cũ vẫn được export để service chưa chuyển đổi tiếp tục dùng.

## Test thêm

- `src/http/filters/all-exceptions.filter.spec.ts`: 6 lớp lỗi qua filter ra đúng status/message/shape, lớp con, HttpException.
- `src/infrastructure/database/transaction-runner.spec.ts` (không cần DB, giả lập `$transaction`): DI qua abstract class, commit, rollback, lồng nhau dùng chung, `isolationLevel`/`timeout`/`maxWait` truyền xuống, ngoài giao dịch `tx` là client thường.
- `test/system/transaction-runner.e2e-spec.ts` (PostgreSQL thật): commit, rollback, lồng nhau, `current_setting('transaction_isolation')`, `requestId` với request song song.

## Bug thấy nhưng không sửa

- `GET /<route không tồn tại>` (không có tiền tố `/api/v1`) trả 404 thân rỗng, không có `X-Request-Id` (không qua `AllExceptionsFilter`). Chưa kiểm là có từ trước task này hay không; không do task này chủ ý.
- `.env` local có `ADMIN_BOOTSTRAP_PASSWORD` ngắn hơn 15 ký tự nên `createTestApp()` fail validate; chạy e2e local cần đặt giá trị như CI.
- Cảnh báo lint `no-explicit-any` / unused import có sẵn trong `cart.service.ts`, `email-throttler.guard.ts`.

## Sửa theo code review

1. **CLI boot.** `CliModule` thiếu `ClsModule` nên `TransactionHost` không resolve được (đã tái hiện: `UnknownDependenciesException` ở `ClsTransactionRunner`). Tách `createClsModule({ mountMiddleware })` vào `src/infrastructure/database/cls.config.ts`; App dùng `mountMiddleware: true`, CLI `false`. `src/cli.ts` chạy lệnh trong `ClsService.run(...)`; e2e CLI cũng bọc như vậy. Đã boot `node dist/cli.js create-admin` thật (exit 2 usage, không lỗi DI). Quy tắc: mọi entry point không phải HTTP (CLI, scheduler, job) phải tự chạy trong `ClsService.run` thì `txHost.tx` mới dùng được.
2. **`IdempotencyStore.start`** trả `Promise<boolean>`: `createMany({ skipDuplicates: true })` (`ON CONFLICT DO NOTHING`), `true` nếu `count === 1`. Không còn P2002 làm hỏng (25P02) giao dịch đang mở nên caller `find()` tiếp được. Cập nhật port, spec task 39, spec task 46, convention; có e2e.
3. **`complete`**: `response` `null` lưu `Prisma.JsonNull`; dùng `updateMany` và ném `Error` thường (lỗi hạ tầng, ra 500) nếu khoá chưa `start`, không phụ thuộc P2025. `IdempotencyJson` đổi cho cùng dạng `Prisma.JsonValue` nên `find()` không còn ép kiểu.
4. **`AllExceptionsFilter`**: `BusinessError` chưa ánh xạ trả 500 + `Internal server error` (message thật chỉ vào log qua stack). Thêm case vào spec.
5. **`AuditLogService.record`** phân biệt overload bằng type guard `'auditLog' in value` thay vì `second ?`, bỏ các `as`; chỉ còn một `second!` ở nhánh legacy.
6. **Comment `app.module.ts`**: bỏ lời khẳng định thứ tự mount; chỉ nêu điều thực sự được bảo đảm (hai ALS độc lập).
7. **`ClsTransactionRunner.run`**: log `warn` (Logger của Nest) khi có `opts` mà đang trong giao dịch (`isTransactionActive()`). Thư viện cũng tự warn một dòng tương tự, nên có hai dòng log; chấp nhận. Không tự retry P2034 (caller chịu trách nhiệm, theo ghi chú ticket 05).
