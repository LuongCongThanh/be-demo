# Thư viện transaction có chạy với NestJS 12 và Prisma 7 không

Type: docs/research
Status: resolved

## Question

`nestjs-cls` + `@nestjs-cls/transactional` + `@nestjs-cls/transactional-adapter-prisma` có dùng được trong repo này không: NestJS `^12.0.1`, Prisma `^7.10.0` với driver adapter `@prisma/adapter-pg`, Prisma Client sinh ra ở `src/generated/prisma/` (không phải `@prisma/client` mặc định), `PrismaService` toàn cục ở `src/infrastructure/database/prisma.service.ts`, vitest. Cần biết: peer dependency của từng gói, có chạy thật (cài thử, build, một test nhỏ commit/rollback) không, có hỗ trợ "nhập vào giao dịch đang có" (propagation Required) mặc định không, có hỗ trợ `$queryRaw` (row lock `FOR UPDATE`) và `isolationLevel` trong giao dịch không, có xung đột với `AsyncLocalStorage` đang dùng ở `src/infrastructure/observability/logging/request-context.ts` không, và mức độ bảo trì của thư viện.

## Answer

**Tương thích**, có vài lưu ý. Chi tiết, bằng chứng từng kiểm tra và đoạn wiring chạy được: [docs/research/11-nestjs-cls-transactional-compatibility.md](../research/11-nestjs-cls-transactional-compatibility.md).

- Đã thử `nestjs-cls@7.0.2`, `@nestjs-cls/transactional@4.0.2`, `@nestjs-cls/transactional-adapter-prisma@2.0.2` với Nest 12.0.1, Prisma 7.10.0 + `@prisma/adapter-pg`, trên Postgres thật; `tsc --noEmit` sạch, 11 test thử đều qua. Peer dependency: Nest `>=10 <13`, Prisma `>4 <9`; `npm ls` không cảnh báo.
- Đạt: commit; rollback khi throw; giao dịch lồng mặc định nhập vào giao dịch đang có (Required); `tx.$queryRaw` với `SELECT ... FOR UPDATE` khóa thật; `isolationLevel`, `timeout`, `maxWait`; `Propagation.Nested` (savepoint, cần `sqlFlavor: 'postgresql'`).
- Không xung đột với `AsyncLocalStorage` của `request-context.ts` (4 request đồng thời giữ đúng `requestId`; chỉ thử thứ tự middleware ClsModule đăng ký trước request-id middleware).
- Lưu ý: `TransactionalAdapterPrisma<PrismaService>` cần ghi rõ kiểu generic vì client sinh ở đường dẫn riêng. Trong probe, vitest không phát decorator metadata nên inject theo kiểu bị lỗi khi dựng Nest testing module; e2e hiện có của repo vẫn dựng Nest app bằng vitest (tsconfig bật `emitDecoratorMetadata`), nên **phải kiểm chứng lại trong repo thật khi triển khai**, đặc biệt với token abstract class đã chốt ở ticket 02. Giới hạn 5 s/2 s của interactive transaction vẫn áp dụng.
- Bảo trì: còn hoạt động (bản 7.0.2 ngày 2026-10-27; hỗ trợ Nest 12 từ 6.3.0, Prisma 7 từ adapter 1.3.2); một maintainer chính.
- Chưa chạy: decorator `@Transactional()`, chế độ interceptor/guard, `nest build` đầy đủ, tải cao; probe chạy trong project dựng lại tương đương, không phải `src/` thật.
