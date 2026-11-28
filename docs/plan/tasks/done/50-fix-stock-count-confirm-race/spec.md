---
status: done
pr: #145
blocked-by:
  - 41-migrate-inventory
---

# Sửa race khi xác nhận phiếu kiểm kê

**Blocked by:** 41-migrate-inventory

**What to build:** Hai request `POST /admin/inventory/counts/:countId/confirm` đồng thời cho cùng một phiếu chỉ được điều chỉnh tồn kho và ghi `inventory_movements` **một lần**. Người dùng chốt ngày 2026-11-27: sửa ngay sau task 41, trước task 42.

**Nguồn:** `docs/plan/tasks/done/41-migrate-inventory/report.md` mục "Ghi nhận, không sửa".

## Hiện trạng

`AdminInventoryService.confirmCount` (`src/modules/inventory/application/admin-inventory.service.ts`) đọc phiếu và kiểm `confirmedAt` **trước** khi khoá dòng `inventory`, sau khoá không đọc lại. Request thứ hai chờ khoá, rồi dùng `physicalCount` cũ để tính delta lần nữa: tồn bị điều chỉnh hai lần, movement bị ghi trùng.

## Việc cần làm

1. Trong cùng `TransactionRunner.run()`: khoá dòng phiếu kiểm kê (hoặc dòng `inventory` trước), rồi đọc lại phiếu và kiểm `confirmedAt` sau khoá. Phiếu đã xác nhận thì trả đúng lỗi/response mà request xác nhận lần hai hiện đang nhận (đọc code để giữ nguyên message và status).
2. Giữ thứ tự khoá nhất quán với `getAvailability({ lockForUpdate })` (theo `variant_id` tăng dần) để không tạo deadlock mới.
3. Chỉ sửa trong `src/modules/inventory/`; đi qua `InventoryRepository`, không dùng Prisma ngoài `infrastructure/`.

## Tiêu chí nghiệm thu

- [ ] Test chứng minh hai lần xác nhận đồng thời chỉ tạo một movement và tồn kho chỉ đổi một lần (test hồi quy cho bug được phép; ưu tiên test trên PostgreSQL thật trong `test/system/`).
- [ ] Request xác nhận đơn lẻ giữ nguyên response, status, message; Swagger diff rỗng.
- [ ] `npm run build`, `typecheck`, `lint`, `lint:boundaries:check`, `test`, `test:e2e` đạt.
- [ ] `report.md`: nguyên nhân, cách sửa, kết quả test.
