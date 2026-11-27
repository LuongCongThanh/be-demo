# Report: task 41, chuyển module inventory sang kiến trúc chung

## Số file trước và sau

- Trước: 5 file trong `src/modules/inventory/` (`inventory.controller.ts`, `inventory.service.ts`, `inventory.service.spec.ts`, `inventory.module.ts`, `dto/inventory.dto.ts`).
- Sau: 9 file: `inventory.module.ts`, `domain/inventory.model.ts`, `application/{admin-inventory.service.ts, admin-inventory.service.spec.ts, inventory.service.ts, ports/inventory.repository.ts}`, `infrastructure/prisma-inventory.repository.ts`, `admin/controllers/inventory.controller.ts`, `admin/dto/inventory.dto.ts`. Mọi file dưới 200 dòng.

## Khác biệt và diễn giải so với spec

1. `InventoryService` (tên cũ, export) nay là class công khai; service Back-office đổi thành `AdminInventoryService`, không export. Không file nào ngoài module từng import `InventoryService` cũ.
2. `getAvailability(variantIds, options?)` trả một phần tử cho mỗi variant theo thứ tự đầu vào; variant chưa có dòng `inventory` trả 0/0/0 (giống checkout đang dùng `?? 0`) thay vì ném lỗi. `availableQuantity` bị chặn dưới 0 (giống `Math.max(0, ...)` của checkout). Hàm Back-office cùng tên vẫn ném `Inventory not found` và không chặn dưới 0 (giữ hành vi cũ).
3. `commitStockForOrder(orderId, lines)` nhận `lines: { variantId, quantity }[]` (không có `reservedQuantity`): service tự khoá và đọc `reservedQuantity` của từng variant (`lockForUpdate`) rồi gọi `decrementIfSufficient(variantId, quantity, reserved)` với đúng điều kiện `quantity: { gte: quantity + reserved }`; sau đó `createMany` `awaiting_dispatch_items`. Checkout hiện đọc `reservedQuantity` trước khi khoá nên task 46 có thể thấy giá trị mới hơn; không đổi hành vi hiện tại vì checkout chưa gọi hàm này.
4. Một port `InventoryRepository` có 9 phương thức. Khoá `FOR UPDATE` nằm trong `findLevels(ids, { lockForUpdate })` (SQL `... WHERE variant_id IN (...) ORDER BY variant_id FOR UPDATE`, giống `lockRows` của checkout); các luồng Back-office một variant dùng cùng hàm này thay cho câu khoá riêng lẻ trước đây (cùng ngữ nghĩa).
5. `GET /admin/inventory/:variantId` trước đây `include` thêm `variant` rồi bỏ đi (không có trong response); adapter không còn đọc quan hệ đó. Response không đổi.
6. `AdminInventoryService` nhận kiểu inline `{ delta, reason }` / `{ physicalCount }` thay vì DTO để `application/` không import DTO (DTO vẫn truyền vào được vì cùng cấu trúc).
7. `InventoryModule` bỏ `imports: [PrismaModule]` (không còn dùng; `TransactionRunner` do `PrismaModule` global cung cấp, adapter dùng `TransactionHost` của `ClsModule` global). Vẫn import `IdentityModule` cho guard.
8. Unit test: thay mock Prisma bằng `FakeInventoryRepository` (cài đặt abstract class port) và `FakeTransactionRunner`; vẫn 5 test như cũ, assertion đổi từ `ConflictException` sang `ConflictError` cùng message. Không thêm test mới.
9. Không có `max-lines` tạm thời nào liên quan inventory.

## Kiểm tra

- `npm run typecheck`, `npm run build`, `npm run lint` (chỉ còn cảnh báo cũ ở `cart.service.ts`, `email-throttler.guard.ts`), `npm run lint:boundaries:check`, `npm run agents:check`, prettier trên file đã sửa: đạt.
- `npm test`: 51 file, 406 test đạt.
- `npm run openapi:write` rồi `git diff --exit-code docs/openapi/openapi.json`: không khác biệt.
- `grep -rnE "PrismaService|#src/generated|@nestjs-cls" src/modules/inventory | grep -v /infrastructure/` rỗng; `domain/` và `application/` không import HTTP exception; grep đường dẫn cũ trong `docs/` (ngoài `docs/plan/`) và `src/**/README.md` rỗng.
- `npm run test:e2e` cục bộ (đặt `ADMIN_BOOTSTRAP_PASSWORD` đủ 15 ký tự): 5 file đạt, 22 file fail với 51 `PrismaClientKnownRequestError` do DB cục bộ thiếu cột `users.interface_locale` (migrate chưa chạy, không liên quan thay đổi này). Không có e2e nào phủ `/admin/inventory`; app vẫn khởi động đủ DI và map đủ 4 route inventory. Kiểm thủ công (spec tạm đã xoá) trên DB thật: `getAvailability([...], { lockForUpdate: true })` trong `run()` chạy được và `commitStockForOrder` với variant không có tồn kho ném `Insufficient stock for variant <id>`. CI chạy đủ e2e.

## Bug phát hiện, không sửa

- Hai route `GET /admin/inventory/:variantId` và `POST .../adjust|counts` không dùng `ParseUUIDPipe`; id không phải UUID chạm DB và ra lỗi Prisma (hành vi cũ, giữ nguyên).
- `GET /admin/inventory/:variantId` và các route khác dùng `@ApiTags('Inventory')` chuỗi thô thay vì `API_TAGS` như module khác (giữ vì Swagger không được đổi).
