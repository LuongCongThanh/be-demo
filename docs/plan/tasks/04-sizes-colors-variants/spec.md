---
status: todo
pr:
blocked-by: [03-product-status-archive]
---

# Spec 04: Size/màu & quy tắc biến thể

Branch: `feature/sizes-colors-and-variant-rules` · Plan tổng: [PR 4](../../realign-identity-catalog.md)

## Problem Statement

Biến thể đang lưu `size`/`color` dạng text tự do, nên có thể trùng tổ hợp, viết sai chính tả, và không lọc được ổn định trên storefront. Ngoài ra còn các điểm lệch so với business:

- SKU không theo định dạng nào và có thể bị đổi.
- Giá là `Decimal(12,2)`, cho phép số lẻ và số 0, trong khi business quy định giá là số nguyên VND lớn hơn 0.
- Sản phẩm không có cân nặng, nên chưa tính được phí ship.
- Ảnh không gắn với màu.

Hệ quả là vi phạm BR-CAT-02..06 và BR-CAT-11.

## Solution

- Admin quản lý **danh sách size** và **bảng màu** dùng chung. Mỗi biến thể chọn đúng một size và một màu trong đó, và tổ hợp size × màu là duy nhất trong một sản phẩm.
- SKU viết in hoa theo định dạng chuẩn và không đổi được.
- Giá là số nguyên VND lớn hơn 0. Cân nặng (gram) bắt buộc ở cấp sản phẩm.
- Ảnh gắn theo màu, mỗi màu có một ảnh chính.
- Storefront lọc được theo mã size và mã màu.

## User Stories

1. As an Admin, I want to create sizes with code, name and display order, so that variants use a consistent size list.
2. As an Admin, I want to reorder sizes, so that the storefront shows S, M, L in a sensible order.
3. As an Admin, I want to create colours with code, name and hex, so that the storefront can render swatches.
4. As an Admin, I want hex validated as `#RRGGBB`, so that swatches always render.
5. As an Admin, I want size/colour codes to be unique, so that filters by code are unambiguous.
6. As an Admin, I want to rename or hide a size/colour, so that I can retire options.
7. As an Admin, I want deletion of sizes/colours to be impossible, so that variants never point at a missing option.
8. As an Admin, I want hidden sizes/colours to disappear from pickers and storefront filters, while existing variants keep working.
9. As an Admin, I want a `FREESIZE` size seeded, so that products without sizes still satisfy "every variant has size and colour".
10. As an Admin, I want to create a variant by choosing `sizeId` and `colorId`, so that I don't type free text.
11. As an Admin, I want creating a duplicate size × colour in the same product to return 409, so that combinations stay unique.
12. As an Admin, I want an unknown or hidden `sizeId`/`colorId` on a new variant rejected, so that only valid options are used.
13. As an Admin, I want SKU validated as uppercase letters, digits and hyphens (e.g. `TSHIRT-BASIC-WHT-M`), so that SKUs are uniform.
14. As an Admin, I want a duplicate SKU anywhere in the system to return 409, so that SKUs stay globally unique.
15. As an Admin, I want SKU to be immutable after creation, so that order references stay stable (stricter than BR-CAT-03 until ordering exists).
16. As an Admin, I want price as integer VND > 0, so that `0` or `100.5` is rejected with 400.
17. As an Admin, I want product weight in grams required and > 0, so that shipping fees can be calculated.
18. As an Admin, I want to attach images to a product colour (with storage key, order and primary flag), so that every size of that colour shares the same photos.
19. As an Admin, I want at most one primary image per product colour, so that the storefront has one thumbnail per colour.
20. As an Admin/Staff, I want to list sizes and colours including hidden ones in back-office, so that I can manage them.
21. As a Staff, I want to receive 403 on size/colour writes, so that only Admins manage the shared lists.
22. As a Customer, I want to filter the product list by size code and colour code, so that I find items in my size/colour (US-102).
23. As a Customer, I want product detail to show each variant's size and colour names and the images per colour, so that I can choose.
24. As an operator, I want the migration to fail loudly if existing prices have fractional parts, so that no price is silently changed.

## Implementation Decisions

- **Bảng mới** (theo 11-database §4.2):
  - `sizes(id, code UK, name, sort_order, is_hidden)`.
  - `colors(id, code UK, name, hex char(7) CHECK, is_hidden)`.
  - Seed `FREESIZE`.
- **product_variants:**
  - Thêm `size_id`, `color_id` NOT NULL, FK RESTRICT. Thêm UK `(product_id, size_id, color_id)`. Bỏ cột text `size`/`color`.
  - `sku` có CHECK `^[A-Z0-9-]+$` (UK toàn hệ thống giữ nguyên).
  - `price` → `bigint` CHECK > 0.
- **products:** `weight_grams int NOT NULL CHECK > 0`.
- **product_images:** thêm `color_id` NOT NULL, `storage_key`, `sort_order`, `is_primary`. Thêm partial UK `(product_id, color_id) WHERE is_primary`.
- **Migration:** SQL tay. Map text size/màu cũ sang bảng mới. Giá có phần lẻ → migration fail rõ ràng (dữ liệu dev). `weight_grams` backfill giá trị tạm cho dữ liệu dev.
- **API sizes/colors:**
  - `GET/POST/PATCH /api/v1/admin/sizes` và `/admin/colors`. Ghi chỉ `ADMIN`, đọc cho `STAFF`, `ADMIN`. Không có DELETE.
  - Mã trùng → 409.
- **API variant:**
  - DTO nhận `sizeId`, `colorId`, `sku` (`@Matches` cùng regex với CHECK), `price` (số nguyên > 0).
  - `UpdateVariantDto` không có `sku`.
  - DB unique violation → 409 qua `AllExceptionsFilter`.
- **API product:** `weightGrams` bắt buộc khi tạo.
- **Images:** endpoint CRUD chỉ lưu metadata, `storage_key` do client cung cấp. Đặt ảnh primary mới sẽ bỏ cờ của ảnh primary cũ trong cùng transaction.
- **Storefront:** `GET /products?size=M&color=WHT` lọc theo mã (có thể truyền nhiều giá trị). Sản phẩm khớp khi có ít nhất một biến thể `active` thoả điều kiện. Size/màu `is_hidden` không xuất hiện trong filter.
- **Kiểu tiền:** giá trả ra JSON dạng number nguyên (VND nằm trong phạm vi an toàn của JS number).

## Testing Decisions

- Test qua HTTP: request tạo/sửa và assert status code, body, kết quả filter storefront. Không test regex hay mapper trực tiếp ngoài những gì DTO bộc lộ.
- Seam duy nhất: **e2e HTTP**. File mới `admin-sizes-colors.e2e-spec.ts`, cập nhật `products.e2e-spec.ts`.
- Ca chính:
  - Giá `0`/`100.5` → 400. SKU `abc` → 400. SKU trùng → 409. Trùng size × màu → 409.
  - Update không đổi được SKU.
  - Thiếu `weightGrams` → 400.
  - Ẩn size đang dùng → OK, không xoá được.
  - Filter `size`/`color` trả đúng.
  - Một ảnh primary trên mỗi màu.
  - Staff ghi size → 403.
- Prior art: `test/products.e2e-spec.ts`, `test/categories.e2e-spec.ts`.

## Out of Scope

Upload ảnh lên object storage thật. Cho phép đổi SKU khi chưa có đơn (chờ ordering). Tồn kho và nhãn "Hết hàng" (BR-CAT-08). Pricing/khuyến mãi. Tìm kiếm không dấu (BR-CAT-13).

## Further Notes

Tham chiếu: BR-CAT-02..06, BR-CAT-11 · US-102 · `11-database` §4.2 · `convention/prisma-conventions.md` (partial index và CHECK phải viết bằng SQL tay).

## Acceptance criteria

- AC1: Giá 0 hoặc 100.5 → 400. SKU `abc` → 400. Trùng size × màu → 409.
- AC2: Ẩn được size/màu đang dùng. Không có cách xoá.
- AC3: Storefront lọc đúng theo mã size/màu.
- AC4: Không đổi được SKU qua API.
- AC5: lint, typecheck, test, test:e2e xanh.
