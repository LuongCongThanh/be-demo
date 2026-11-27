# Hợp đồng transaction trong và giữa các module

Type: grilling
Status: resolved

## Question

Chọn một hình thức transaction thống nhất. Hiện có ba hình thức mâu thuẫn: quyết định 04 của map cũ cho phép truyền `Prisma.TransactionClient` qua public service của module khác; Category dùng `transaction(work: (tx: CategoryPersistenceOperations) => ...)` (object thao tác theo transaction, không lộ Prisma); doc 01 đặc tả `TransactionPort.runInTransaction` + AsyncLocalStorage nhưng không có code nào dùng. Vì mọi module dùng một kiến trúc (ADR 0015) và `tx` của Prisma không được đi qua Port, chọn **một** hình thức chung. Bảng so sánh 4 cách (method atomic trong Port, TransactionPort + AsyncLocalStorage như `nestjs-cls`, truyền `tx`, service gọi Prisma) ở [research 10 §5](../research/10-nestjs-reference-architectures.md). Quyết định: hình thức trong một module, hình thức cho transaction xuyên module (module điều phối nắm transaction), và số phận phần đặc tả TransactionPort/ALS trong doc 01 (giữ, đưa ra phụ lục, hay bỏ).

## Answer

Chốt qua grilling ngày 2026-11-24, có kiểm chứng ở [Thư viện transaction có chạy với NestJS 12 và Prisma 7 không](./11-nestjs-cls-transactional-compatibility.md).

1. **Một cách duy nhất cho toàn app: "hộp giao dịch" (`AsyncLocalStorage`).** Service mở giao dịch bằng `transactionRunner.run(async () => { ... })` rồi gọi port/service công khai như bình thường. Adapter Prisma tự dùng client của giao dịch đang mở (nếu có), không thì dùng client thường. **Port không có tham số `tx`.** Transaction xuyên module chạy qua service công khai của từng module; không module nào ghi bảng của module khác.
2. **Thư viện:** dùng `nestjs-cls` + `@nestjs-cls/transactional` + `@nestjs-cls/transactional-adapter-prisma` (đã xác nhận tương thích).
3. **SOLID / clean code:** service (tầng `application/`) **không import thư viện**. Dự án khai báo một abstract class `TransactionRunner` (port dùng chung, cạnh `src/infrastructure/database/`), cài đặt bằng `TransactionHost` của thư viện. Chỉ code trong `infrastructure/` (adapter Prisma và cài đặt `TransactionRunner`) được dùng `TransactionHost`. Không dùng decorator `@Transactional()` trong service, vì nó gắn tầng `application/` vào thư viện. Đổi thư viện sau này chỉ sửa tầng `infrastructure/`.
4. **Giao dịch lồng nhau:** mặc định nhập vào giao dịch đang có (propagation Required của thư viện): một service công khai dùng được cả khi gọi riêng lẫn khi gọi từ bên trong giao dịch của checkout. Không dùng `Nested`/`RequiresNew` trừ khi có quyết định riêng.
5. **Không gọi ra ngoài trong giao dịch:** không gửi mail, upload, gọi Google/provider bên trong `run()`; làm sau khi giao dịch xong hoặc qua outbox (ADR-0003). Giữ giao dịch ngắn (Prisma hủy sau 5 s mặc định). Row lock (`SELECT ... FOR UPDATE`) và `isolationLevel` vẫn dùng được trong adapter.
6. **Thay thế:** cách `transaction(work: (ops) => ...)` của Category; phần "truyền `Prisma.TransactionClient` qua public service" trong quyết định 04 của map `feature-module-boundaries`; đặc tả `TransactionPort` + "nested bị từ chối" của doc 01 v1.6 (doc này sẽ bị xóa theo ticket 01).
7. **Kiểm chứng khi triển khai:** DI theo kiểu (abstract class token, `TransactionHost`) trong vitest phải chạy được với cấu hình test thật của repo; nếu không, thêm SWC cho vitest hoặc dùng `@Inject(...)` tường minh.

### Bổ sung 2026-11-27

`TransactionRunner.run<T>(work, opts?)` nhận `opts { isolationLevel?, timeout?, maxWait? }`: service chọn mức cô lập khi mở giao dịch, adapter nhập vào giao dịch không đặt isolation, và nơi gọi `run` sở hữu việc retry khi gặp `P2034`.
