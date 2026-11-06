# Spec: Căn chỉnh identity & catalog theo docs business (91c255c)

> Trạng thái: **Nháp** ([quy ước](../README.md#trạng-thái-tài-liệu)).

Nguồn chuẩn: `docs/business/*` > `docs/architecture/11-database.md` > `docs/adr/*`. Code hiện tại (auth/categories/products, schema Prisma) viết trước 91c255c nên lệch.

## Quyết định đã chốt

- Sửa lệch identity + catalog **trước** khi làm module mới (cart, pricing, inventory…).
- Docs business là chuẩn cho mọi điểm lệch (giá = VND nguyên, ảnh theo màu…).
- Role đổi tên bằng **migration SQL viết tay**, giữ dữ liệu.
- **Một** endpoint `/api/v1/auth/login` cho mọi vai trò, response/token trả `role`; FE tự từ chối sai kênh; server chặn bằng `@Roles` trên từng route (ADR 0005).
- 5 PR độc lập, theo thứ tự dưới. Google login + hồ sơ khách hàng để sau.

## Ngoài phạm vi

Google login (US-502), hồ sơ khách hàng (name/phone/locale), guest cart/guest order session, tìm kiếm không dấu + sort bán chạy (BR-CAT-12/13), `product_sales_stats`, upload ảnh lên object storage thật, audit log đầy đủ cho mọi module.

---

## PR 1 — `refactor/rename-roles-to-four-actor-model`

**Mục tiêu:** role khớp ADR 0005; quyền ghi catalog chỉ cho `admin`.

Schema / migration:

- Enum `Role`: `customer`, `staff`, `admin` (guest không có dòng). Bỏ `STORE_MANAGER`, `MASTER_ADMIN`.
- Migration SQL tay: `STORE_MANAGER → staff`, `MASTER_ADMIN → admin`, `CUSTOMER → customer` (map 1-1, không mất dữ liệu). Nếu role đang là bảng (auth.service.ts:86 lookup) thì đổi thành cột enum `users.role`.
- `UserStatus`: `ACTIVE/BLOCKED` → `active/disabled` (11-database §4.1).
- Đổi `authorizationVersion` → `session_version` nếu tên khác docs (kiểm tra trước, chỉ đổi khi rẻ).
- `prisma/seed.ts`: seed theo role mới.

Code:

- Mọi `@Roles(...)` khai báo tường minh danh sách role (ADR 0005, không suy cây phân cấp).
- Catalog write (category, product, variant create/update/archive): `@Roles('admin')` (02-actors §3.2).
- GLOSSARY: không còn tên role cũ nào trong `src/`, `test/` (`grep -r "STORE_MANAGER\|MASTER_ADMIN"` rỗng).

Acceptance:

- Staff gọi POST `/admin/products` → 403; Admin → 201.
- e2e auth/categories/products xanh với role mới.

---

## PR 2 — `feature/backoffice-login-and-staff-management`

**Mục tiêu:** login trả `role`; Admin tạo bằng CLI; Admin quản lý Staff (02-actors §1, §4).

API:

- `POST /api/v1/auth/login`: dùng chung mọi vai trò; response có `role` (và trong JWT). Storefront/back-office FE từ chối vai trò sai kênh bằng lỗi chung và huỷ token.
- Route mua hàng (cart, checkout — khi có) `@Roles('customer')`; `/admin/*` `@Roles('staff','admin')`.
- `POST /api/v1/auth/register`: email đã thuộc tài khoản nội bộ → lỗi chung (mỗi email một Tài khoản).
- `GET/POST/PATCH /api/v1/admin/staff` (admin only): tạo Staff, đổi tên, `disable`/`enable`. Không tạo/sửa Admin qua API.
- Disable Staff → tăng `session_version` → mọi phiên mất hiệu lực **ngay** (request kế tiếp với access token cũ → 401).

CLI:

- `npm run cli -- create-admin --email --name` (nhập mật khẩu qua prompt, không qua argv). Dùng `nest-commander` hoặc script standalone với `NestFactory.createApplicationContext`.
- Email đã tồn tại → báo lỗi, không ghi đè.

Audit (tối thiểu, chỉ cho hành động trong PR này):

- Bảng `audit_logs` theo 11-database §4.1; ghi khi tạo/sửa/disable Staff.

Acceptance:

- Token Staff gọi route `@Roles('customer')` (vd. `GET /auth/me` phía customer hoặc route test) → 403; token customer gọi `/admin/*` → 403.
- Response login có `role`.
- Disable Staff khi đang đăng nhập → request tiếp theo 401.
- Có e2e cho mỗi rule trên.

---

## PR 3 — `refactor/product-status-and-archive`

**Mục tiêu:** BR-CAT-07, BR-CAT-09.

Schema:

- `ProductStatus`: `draft`/`active`/`archived`, default `draft`. Migration map `ACTIVE→active`, `INACTIVE→archived`.
- `VariantStatus`: `active`/`archived`.
- `published_at` (set lần đầu chuyển sang `active`).
- FK `product_variants.product_id` đổi `CASCADE` → `RESTRICT`.

API:

- Bỏ DELETE product/variant; thay bằng `POST .../archive` (và `.../unarchive` nếu cần). Vì module ordering chưa có, **luôn archive, không bao giờ xoá cứng** — đơn giản và an toàn hơn kiểm tra "đã có đơn".
- Tách route: storefront `GET /api/v1/products` chỉ trả `active` (bỏ filter `status` do client gửi); back-office `GET /api/v1/admin/products` lọc được mọi status.
- Biến thể `archived` không hiện trên storefront.

Acceptance:

- Sản phẩm `draft`/`archived` → 404 ở storefront detail, vẫn thấy ở back-office.
- Không còn endpoint DELETE nào cho product/variant.

---

## PR 4 — `feature/sizes-colors-and-variant-rules`

**Mục tiêu:** BR-CAT-02..06, BR-CAT-11.

Schema (theo 11-database §4.2):

- Bảng `sizes(code UK, name, sort_order, is_hidden)`, `colors(code UK, name, hex char(7), is_hidden)`. Seed `FREESIZE`.
- `product_variants`: `size_id`, `color_id` NN (FK RESTRICT); UK `(product_id, size_id, color_id)`; bỏ cột `size`/`color` text.
- `sku`: CHECK `^[A-Z0-9-]+$`; DTO `@Matches` cùng regex.
- `price`: `Decimal(12,2)` → `bigint`, CHECK > 0. Migration: dữ liệu có phần lẻ → làm tròn hoặc fail (dev data — fail rõ ràng là được).
- `products.weight_grams` int NN CHECK > 0 (migration: backfill giá trị tạm cho dữ liệu dev hoặc reset).
- `product_images`: thêm `color_id` NN, `storage_key`, `sort_order`, `is_primary` + partial UK `(product_id, color_id) WHERE is_primary` (migration SQL tay).

API:

- `GET/POST/PATCH /api/v1/admin/sizes`, `/admin/colors` (admin only). Không có DELETE; đã có Biến thể dùng thì chỉ `is_hidden = true`.
- Variant DTO nhận `sizeId`, `colorId`; trùng tổ hợp → 409.
- Update variant: **chặn đổi SKU** (bỏ `sku` khỏi UpdateVariantDto; mở lại khi có ordering và kiểm tra "đã có đơn").
- Storefront list hỗ trợ filter `size` / `color` theo **mã** (US-102).
- Image endpoints: chỉ metadata (storage_key do client cung cấp); upload thật để sau.

Acceptance:

- Giá 0 hoặc 100.5 → 400. SKU `abc` → 400. Trùng size×màu → 409.
- Ẩn size đang dùng được; không xoá được.

---

## PR 5 — `feature/nested-categories`

**Mục tiêu:** danh mục nhiều cấp (02-modules, ADR 0001).

- `categories.parent_id` FK self RESTRICT + IX; thêm `sort_order`, `is_visible`.
- Tạo/sửa: chặn vòng lặp (A→B→A) ở service; parent không tồn tại → 404/400.
- Xoá danh mục có con hoặc có sản phẩm → 409 (ADR 0001).
- Storefront: `GET /api/v1/categories` trả cây, chỉ `is_visible`.

Acceptance: e2e cho vòng lặp, 409 khi còn con/sản phẩm, cây trả đúng thứ tự.

---

## Sau 5 PR

1. Cập nhật `docs/architecture/modules/identity.md`, `catalog.md` từ "Nháp" → "Đã chốt cho MVP".
2. Module tiếp theo: **pricing → inventory → cart** (cart phụ thuộc giá áp dụng BR-CRT-04 và trần tồn kho BR-CRT-03), rồi ordering, payments.
