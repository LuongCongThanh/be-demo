---
status: todo
pr:
blocked-by:
  - 46-migrate-checkout
---

# Ghi movement khi trừ kho cho đơn hàng

**Blocked by:** 46-migrate-checkout

**What to build:** Mỗi lần trừ tồn kho cho đơn hàng (`InventoryService.commitStockForOrder`) ghi một dòng `inventory_movements` cho mỗi variant, lý do gắn với mã đơn hàng, để sổ movement khớp với số tồn. Người dùng chốt ngày 2026-11-27; làm sau task 46 vì task 41 và 46 chỉ refactor, không đổi hành vi.

**Nguồn:** `docs/plan/tasks/done/41-migrate-inventory/report.md` mục "Sửa theo code review".

## Hiện trạng

`adjust` và `confirmCount` ghi movement; checkout (và `commitStockForOrder` chép theo checkout) trừ `inventory.quantity` mà không ghi movement.

## Việc cần làm

1. Trong `commitStockForOrder`, sau mỗi lần trừ thành công, ghi movement (số lượng âm, `quantityBefore`/`quantityAfter` theo cách `adjust` đang ghi) trong cùng giao dịch, qua `InventoryRepository`.
2. Chọn giá trị `reason`/tham chiếu đơn hàng theo schema `inventory_movements` hiện có. Nếu schema không có chỗ cho mã đơn hàng mà phải thêm cột/migration, dừng lại hỏi người dùng.
3. Cập nhật `docs/architecture/modules/inventory.md`.

## Tiêu chí nghiệm thu

- [ ] Đặt hàng thành công tạo đúng một movement mỗi variant; đặt hàng thất bại vì thiếu hàng không tạo movement nào.
- [ ] Response checkout không đổi; Swagger diff rỗng.
- [ ] `npm run build`, `typecheck`, `lint`, `test`, `test:e2e` đạt.
- [ ] `report.md` ghi lựa chọn `reason` và kết quả.
