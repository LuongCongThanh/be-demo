---
status: todo
pr:
blocked-by: [02-login-role-staff-cli]
---

# Spec 03: Trạng thái sản phẩm & archive

Branch: `refactor/product-status-and-archive` · Plan tổng: [PR 3](../../realign-identity-catalog.md)

## Problem Statement

- Sản phẩm hiện chỉ có `ACTIVE/INACTIVE`. Không có trạng thái nháp nên Admin không soạn trước được sản phẩm mà không công khai nó (BR-CAT-07).
- Product và variant có thể bị xoá cứng, và FK `CASCADE` kéo theo xoá cả biến thể. Khi có module ordering, việc này sẽ phá dữ liệu đơn hàng (BR-CAT-09).
- Storefront và back-office dùng chung một route list. Client tự gửi filter `status`, nên khách có thể xem sản phẩm chưa bán.

## Solution

- Sản phẩm có ba trạng thái `draft → active → archived`, mặc định `draft`. Biến thể có `active/archived`.
- Không còn endpoint xoá: mọi lần "xoá" thành archive (và unarchive được).
- Storefront chỉ thấy sản phẩm `active` cùng các biến thể `active`. Back-office có route riêng `/admin/products` lọc được mọi trạng thái.

## User Stories

1. As an Admin, I want new products to start as `draft`, so that I can prepare them before customers see them.
2. As an Admin, I want to publish a draft (set `active`), so that it appears on the storefront.
3. As an Admin, I want `published_at` recorded the first time a product becomes active, so that I know when it went live.
4. As an Admin, I want `published_at` to stay unchanged when I archive and reactivate, so that the first publish date is preserved.
5. As an Admin, I want to archive a product instead of deleting it, so that past orders keep referencing it.
6. As an Admin, I want to unarchive a product, so that I can resume selling it.
7. As an Admin, I want to archive a single variant, so that I can stop selling one size/colour without touching the product.
8. As an Admin, I want to unarchive a variant, so that I can bring it back.
9. As an Admin, I want no DELETE endpoint for products or variants, so that I cannot accidentally destroy catalog history.
10. As an Admin, I want the database to refuse deleting a product that still has variants, so that even a manual mistake can't cascade.
11. As an Admin/Staff, I want `GET /admin/products` to filter by any status, so that I can manage drafts and archived items.
12. As an Admin/Staff, I want `GET /admin/products/:id` to return products of every status, so that I can edit drafts.
13. As a Customer, I want the storefront list to show only `active` products, so that I don't see unfinished or discontinued items.
14. As a Customer, I want a draft or archived product's detail page to return 404, so that hidden products stay hidden.
15. As a Customer, I want archived variants omitted from product detail, so that I can only pick purchasable options.
16. As a Customer, I want any `status` query param I send on the storefront to be ignored or rejected, so that I can't bypass visibility.
17. As an operator, I want existing data migrated (`ACTIVE → active`, `INACTIVE → archived`), so that nothing becomes visible or invisible unexpectedly.
18. As a Staff, I want to receive 403 on archive/unarchive, so that catalog writes stay Admin-only (task 01).

## Implementation Decisions

- **Schema:**
  - `ProductStatus { draft, active, archived }`, mặc định `draft`.
  - `VariantStatus { active, archived }`, mặc định `active`.
  - `products.published_at` timestamptz nullable, chỉ set lần đầu chuyển sang `active`.
  - FK `product_variants.product_id` đổi sang `ON DELETE RESTRICT`.
- **Migration:** SQL tay, map `ACTIVE → active`, `INACTIVE → archived`. Backfill `published_at = created_at` cho các dòng `active`.
- **Chuyển trạng thái:** `draft → active`, `active ↔ archived`, `draft → archived` đều hợp lệ. `active/archived → draft` không cho phép (400). Đổi trạng thái qua `PATCH` field `status` hoặc qua các endpoint `POST .../archive` và `.../unarchive`. Archive/unarchive idempotent.
- **Xoá:** bỏ hẳn DELETE product/variant. Luôn archive, không kiểm tra "đã có đơn", vì chưa có module ordering.
- **Routes:**
  - Storefront `GET /api/v1/products` và `/products/:id` công khai, chỉ trả `active` cùng biến thể `active`. Không nhận param `status`.
  - Back-office `GET /api/v1/admin/products` và `/admin/products/:id` cho `STAFF`, `ADMIN`, lọc theo `status`.
  - Các route ghi chuyển sang `/admin/products…`, chỉ `@Roles('ADMIN')`.

## Testing Decisions

- Test qua HTTP: tạo sản phẩm ở từng trạng thái, rồi kiểm tra cái nào hiện ở route storefront và route admin. Không test service hay transition table trực tiếp.
- Seam duy nhất: **e2e HTTP**, cập nhật `products.e2e-spec.ts` (hoặc tách `admin-products.e2e-spec.ts`).
- Ca chính:
  - Mặc định `draft`.
  - `published_at` set một lần.
  - Draft/archived → 404 ở storefront, thấy được ở admin.
  - Biến thể archived bị ẩn ở storefront.
  - DELETE → 404/405.
  - Chuyển trạng thái sai → 400.
  - Staff archive → 403.
- Prior art: `test/products.e2e-spec.ts`.

## Out of Scope

Kiểm tra "đã có đơn" trước khi xoá (chờ module ordering). Nhãn "Hết hàng" (BR-CAT-08). Lịch đăng bán tự động. Tìm kiếm và sort bán chạy.

## Further Notes

Tham chiếu: BR-CAT-07, BR-CAT-09 · `11-database` §4.2 · `architecture/modules/catalog.md`. Việc tách route storefront/admin ở đây là nền cho filter size/màu (task 04).

## Acceptance criteria

- AC1: Sản phẩm `draft`/`archived` → 404 ở storefront detail, vẫn thấy ở back-office.
- AC2: Không còn endpoint DELETE cho product/variant. FK là RESTRICT.
- AC3: Migration giữ đúng trạng thái dữ liệu cũ.
- AC4: lint, typecheck, test, test:e2e xanh.
