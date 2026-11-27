# Report: task 42, chuyển module voucher sang kiến trúc chung

## Số file trước và sau

- Trước: 9 file trong `src/modules/voucher/` (`voucher.module.ts`, `controllers/admin/admin-voucher.controller.ts`, `services/admin/admin-voucher.service.ts` 219 dòng thô, `domain/voucher-status.ts`, 5 file `dto/admin/*.dto.ts`).
- Sau: 15 file: `voucher.module.ts`, `domain/{voucher.model.ts, voucher-status.ts, voucher-rules.ts}`, `application/{admin-voucher.service.ts, voucher.service.ts, ports/voucher.repository.ts}`, `infrastructure/{prisma-voucher.repository.ts, voucher-status-where.ts}`, `admin/controllers/admin-voucher.controller.ts`, `admin/dto/*.dto.ts` (5 file). File lớn nhất (`prisma-voucher.repository.ts`) 138 dòng tính; `AdminVoucherService` 110 dòng tính. Không file voucher nào có trong `MAX_LINES_TEMPORARY_EXEMPT`.

## Khác biệt và diễn giải so với spec

1. `VoucherService.evaluate(code, buyer, subtotal, options?: { lockForUpdate?, now? })` trả đủ `VoucherSnapshot` của checkout (thêm `startsAt`, `endsAt`, `isActive` ngoài danh sách trong spec). `now` mặc định `new Date()`. Hai message giữ đúng: `Voucher "<code>" is unavailable or does not meet its conditions` và `Voucher "<code>" has reached this buyer's usage limit`, đều ném `InvalidInputError`. Số tiền vượt phạm vi an toàn ném `InvalidInputError('Checkout amounts exceed the supported numeric range')` (checkout dùng `BadRequestException` cùng message, cùng 400).
2. `lockForUpdate` chạy `SELECT id FROM vouchers WHERE code = ... FOR UPDATE` ở adapter, rồi mới đọc; ngoài giao dịch ném `Error` thường (như inventory).
3. `recordUsage(voucherId, orderId, buyer, discount)`: `incrementUsedCount` rồi `addUsage` (`userId` và `phone` lấy từ `buyer`), giống checkout. Checkout không bị sửa.
4. Domain Model dùng `number` cho tiền (adapter đổi từ `BigInt`). Việc kiểm `isSafeInteger` cho kết quả như cũ vì mọi `bigint` ngoài vùng an toàn đổi sang `number` không an toàn. Model không có `createdById` nên response admin không lộ thêm trường.
5. `VoucherType` (const + type) khai báo trong `domain/voucher.model.ts` thay cho enum Prisma sinh ra, để `admin/dto` không import `#src/generated`. Giá trị và thứ tự `PERCENT`, `FIXED` giống nhau; `openapi.json` không đổi.
6. `voucherStatus` giữ trong `domain/`; `voucherStatusWhere` (trả kiểu Prisma) chuyển sang `infrastructure/voucher-status-where.ts`.
7. Hàm thuần tách khỏi service sang `domain/voucher-rules.ts`: `assertTerms`, `changedFields`, `EDITABLE_AFTER_USE`, `NOT_NULL`, `isApplicable`, `toSnapshot`, `safeAmount`.
8. `AdminVoucherService` nhận kiểu inline/domain (`VoucherListQuery`, `VoucherChanges`, input tạo) thay vì DTO, và trả `VoucherWithStatus` (model kèm `status`) thay cho `toResponse`; không còn mapper vì hình dạng giống `VoucherResponseDto`. Thứ tự khoá trong JSON có `status` ở cuối (không đổi tên/giá trị trường).
9. Lỗi: `NotFoundException` -> `NotFoundError`, `ConflictException` -> `ConflictError`, `BadRequestException` -> `InvalidInputError`, giữ nguyên message. Trùng mã: adapter bắt `P2002` và trả `null`, service ném `ConflictError('Voucher code "<code>" already exists')`.
10. `update`/`remove` mở giao dịch bằng `TransactionRunner.run()` thay cho `prisma.$transaction`; khoá dòng theo `id` nằm trong `PrismaVoucherRepository.lockById`.
11. `VoucherModule` vẫn import `PassportModule.register({})` (không đổi hành vi); export `VoucherService`.
12. Không có unit spec voucher, nên không sửa/thêm test nào.

## Kiểm tra

- `npm run typecheck`, `npm run build`, `npm run lint` (chỉ còn cảnh báo cũ ở `cart.service.ts`, `email-throttler.guard.ts`), `npm run lint:boundaries` + `lint:boundaries:check`, `npm run agents:check`, prettier trên file đã sửa: đạt.
- `npm test`: 51 file, 408 test đạt.
- `npm run openapi:write` rồi `git diff --exit-code docs/openapi/openapi.json`: không khác biệt.
- `grep -rnE "PrismaService|#src/generated|@nestjs-cls" src/modules/voucher | grep -v /infrastructure/` rỗng; `domain/` và `application/` chỉ import `Injectable` từ `@nestjs/common`, không import HTTP exception; grep đường dẫn cũ (`voucher/controllers`, `voucher/services`, `voucher/dto`) trong `docs/` (ngoài `docs/plan/`) và `src/` rỗng.
- `npm run test:e2e` không chạy được cục bộ (DB cục bộ thiếu migration); CI chạy đủ. Chưa có test cho `VoucherService` và `PrismaVoucherRepository` (giai đoạn test được hoãn).

## Bug phát hiện, không sửa

- Checkout tự có `findVoucher`/`lockVoucher`/ghi lượt dùng riêng, trùng với `VoucherService`; task 46 sẽ chuyển sang gọi service, hiện chưa đổi.
- `evaluate` đọc `usedCount` và đếm lượt dùng không kèm khoá nếu gọi không có `lockForUpdate`; caller phải khoá khi đặt đơn (giống checkout hiện tại).
