# Ownership dữ liệu cho cart và checkout

Type: grilling
Status: resolved

## Question

Cart và checkout truy cập bảng của module khác qua public service nào? Hiện trạng vi phạm quyết định 04 của map cũ: `checkout.service.ts` ghi trực tiếp `inventory`, `voucher`, `voucherUsage` và đọc `productVariant`, `salePrice` trong transaction; `cart.service.ts` đọc `productVariant` và import `catalog/pricing/domain/active-sale-prices.js` (file domain gọi Prisma). `InventoryModule` đã export `InventoryService` nhưng checkout không dùng. Quyết định: những public capability nào cần có (Catalog: tra variant/giá; Voucher: kiểm tra và ghi nhận sử dụng; Inventory: trừ/giữ tồn), module nào export chúng, chữ ký nhận transaction theo ticket 05, và thứ tự phụ thuộc một chiều giữa các module.

## Answer

Chốt qua grilling ngày 2026-11-24. Sở hữu bảng theo ma trận ở `docs/architecture/02-modules.md` §2 (`awaiting_dispatch_items` thuộc inventory; `vouchers`, `voucher_usages` thuộc voucher). Giao dịch theo [Hợp đồng transaction trong và giữa các module](./05-transaction-contract.md).

1. **Hàm công khai tối thiểu**, đặt tên theo việc nghiệp vụ, chỉ đụng bảng của module chủ, trả về `type` thuần (không Prisma, không DTO), ném lỗi từ bộ lỗi chung:
   - Catalog: `getPurchasableVariants(variantIds)` → tên, size, màu, cân nặng, giá gốc, giá khuyến mãi đang chạy (gom phần đọc `product_variants` và `sale_prices`, thay cho `pricing/domain/active-sale-prices.ts` mà cart đang import).
   - Inventory: `getAvailability(variantIds)` → số lượng, số đang giữ, số còn bán được; `commitStockForOrder(orderId, lines)` → trừ tồn (điều kiện đủ hàng) và tạo `awaiting_dispatch_items`; thiếu hàng ném `ConflictError`.
   - Voucher: `evaluate(code, buyer, subtotal)` → thông tin voucher nếu dùng được (hạn, điều kiện, giới hạn tổng, giới hạn mỗi người mua), không thì ném lỗi; `recordUsage(voucherId, orderId, buyer, discount)` → tăng `usedCount` và tạo `voucher_usages`.
   - Không thêm hàm khi chưa có module nào cần.
2. **Chiều gọi một chiều, không vòng:**
   ```text
   checkout ──> catalog, inventory, voucher, identity (guard)
   cart     ──> catalog, inventory, identity (guard)
   catalog  ──> inventory (hiển thị tồn kho trên trang sản phẩm; thay cho việc product.service đọc thẳng bảng inventory)
   inventory, voucher ──> không gọi module nghiệp vụ nào
   ```
   Consumer hỏi thẳng module sở hữu dữ liệu (cart/checkout hỏi catalog về hàng và giá, hỏi inventory về tồn), không nhờ module trung gian hỏi hộ.
3. **Class công khai riêng:** mỗi module export đúng một class công khai trong `application/` (`CatalogService`, `InventoryService`, `VoucherService`) chỉ chứa hàm cho module khác. Service cho bề mặt Admin/Storefront đặt tên riêng (ví dụ `admin-inventory.service.ts`) và không export. `IdentityModule` giữ exports hiện tại theo quyết định 04 của map `feature-module-boundaries`.
4. **Checkout tạm sở hữu** `checkout_quotes`, `orders`, `order_items` cho đến khi có module `ordering` (tách module nằm ngoài phạm vi). `idempotency_keys` (ma trận ghi thuộc hạ tầng outbox) do [Cách tách checkout](./07-checkout-structure.md) quyết định.
5. **Tài liệu cần sửa khi triển khai:** đoạn cuối `docs/architecture/02-modules.md` §2 ("`Prisma.TransactionClient` được truyền vào service của module khác") và `docs/architecture/04-data-consistency.md` phần tương ứng, theo hợp đồng transaction mới.
