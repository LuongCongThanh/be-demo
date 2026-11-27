# Report: task 50, sửa race khi xác nhận phiếu kiểm kê

## Nguyên nhân

`AdminInventoryService.confirmCount` đọc phiếu và kiểm `confirmedAt` trước khi khoá dòng `inventory`, và không đọc lại sau khoá. Hai request đồng thời cùng thấy phiếu chưa xác nhận; request thứ hai chờ khoá rồi dùng `physicalCount` cũ để tính delta lần nữa, nên tồn bị điều chỉnh hai lần và `inventory_movements` bị ghi trùng.

## Cách sửa

Trong cùng `TransactionRunner.run()`: đọc phiếu (trả ngay nếu đã xác nhận, như trước) → khoá dòng `inventory` của biến thể (`findLevels(..., { lockForUpdate: true })`) → **đọc lại phiếu sau khoá** → nếu đã xác nhận thì trả phiếu đó. Request thứ hai vì vậy nhận đúng response như lần xác nhận tuần tự thứ hai (cùng phiếu đã xác nhận, cùng status), không ghi gì thêm. Chỉ khoá một dòng `inventory` nên thứ tự khoá không đổi so với `findLevels` (`variant_id` tăng dần); không có deadlock mới. Không đổi port, không đổi Prisma/SQL, không đổi Swagger.

## Test

- Unit (`admin-inventory.service.spec.ts`): thêm test "phiếu đã được request song song xác nhận": lần đọc đầu cũ (chưa xác nhận), lần đọc sau khoá đã xác nhận, không gọi `setQuantity`/`addMovement`/`confirmStockCount`. Đã xác nhận đỏ khi bỏ bản sửa, xanh khi có.
- E2E trên PostgreSQL thật (`test/system/stock-count-confirm-race.e2e-spec.ts`): hai `confirmCount` song song cho một phiếu chỉ đổi tồn một lần và tạo một movement; confirm tuần tự lần hai trả lại phiếu đã xác nhận. **Chưa chạy được cục bộ**: DB dev thiếu bảng `inventory_movements` (và cột `users.interface_locale`), không được migrate; không tạo được database tạm (không có quyền). Chưa quan sát được test đỏ trên DB thật; CI chạy trên DB mới.
