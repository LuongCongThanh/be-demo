# Products + Product Variants — Design Spec

> Phase 2 (Mục 22) — phần còn lại sau Categories (`doc/categories-module-plan.md`). Không bao gồm product images/Object Storage — đó là sub-project riêng, brainstorm sau khi module này xong.

## 1. Bối cảnh & vấn đề

Categories đã có plan (chưa build). `products.category_id` là FK bắt buộc tới `categories`, nên Products phải build sau Categories, dùng category thật (không mock) để test. Model `Product`, `ProductVariant`, `Inventory`, `ProductImage` đã có sẵn trong `prisma/schema/schema.prisma` và đã migrate (`20260911030156_init_ecommerce`) — không cần migration mới cho module này.

Tài liệu kiến trúc (Mục 8) tự ghi nhận 2 quyết định còn mở cho Products/Variants: variant nằm lồng dưới Product hay là resource top-level; và ai được ghi dòng `inventory` khi tạo variant (Inventory là module riêng của Phase 4). Cả 2 đã được chốt qua brainstorming — xem Mục 4.

## 2. Phạm vi (Scope)

1. CRUD `Product` (`name`, `categoryId`, slug tự sinh, `status`).
2. CRUD `ProductVariant`, nested dưới Product (`/products/:id/variants`).
3. Tạo `ProductVariant` tự động tạo kèm 1 dòng `Inventory` (quantity=0), trong cùng 1 transaction Prisma.

## 3. Non-goals

- **Product images / Object Storage** — upload ảnh, chọn ảnh primary, chọn storage provider (S3/MinIO/local disk) — sub-project riêng, brainstorm sau.
- **Inventory API** (`GET`/`PATCH /inventory/:variantId/adjust`) — thuộc Phase 4 (Mục 22), không phải phạm vi module này. Module này chỉ _tạo_ dòng inventory ban đầu, không expose endpoint đọc/sửa nó.
- **Cart/Order tham chiếu variant** — Cart/Orders là Phase 4/5, chưa tồn tại lúc module này build; mọi cân nhắc về "xoá variant đang được Cart/Order tham chiếu" chưa áp dụng được ở đây (xem Mục 6 — Non-goals hiện tại, cần rà soát lại khi Cart/Orders build).
- **Search/filter nâng cao** (full-text search sản phẩm) — Mục 19 để dành cho Phase 9 khi có nhu cầu đo được.

## 4. Kiến trúc & quyết định đã chốt

### 4.1 API surface

```
GET    /api/v1/products                          — public, phân trang, filter category_id/status
GET    /api/v1/products/:id                       — public
POST   /api/v1/products                           — STORE_MANAGER/MASTER_ADMIN
PATCH  /api/v1/products/:id                        — STORE_MANAGER/MASTER_ADMIN
DELETE /api/v1/products/:id                        — STORE_MANAGER/MASTER_ADMIN

GET    /api/v1/products/:id/variants                     — public
GET    /api/v1/products/:id/variants/:variantId           — public
POST   /api/v1/products/:id/variants                      — STORE_MANAGER/MASTER_ADMIN
PATCH  /api/v1/products/:id/variants/:variantId            — STORE_MANAGER/MASTER_ADMIN
DELETE /api/v1/products/:id/variants/:variantId            — STORE_MANAGER/MASTER_ADMIN
```

**Quyết định (đã chốt qua brainstorming):** Variant là resource **nested** dưới Product, không phải top-level `/product-variants` — variant luôn được truy cập trong context 1 product cụ thể, khớp đúng quan hệ 1:N thật của schema, và URL tự thể hiện quyền sở hữu.

### 4.2 `Product`

- `name` (bắt buộc, `@MaxLength(255)`), `categoryId` (bắt buộc, UUID — 404 nếu category không tồn tại), `status` (`ACTIVE`/`INACTIVE`, default `ACTIVE`).
- `slug` tự sinh từ `name` bằng `slugify` (giống Category — `{ lower: true, locale: 'vi', strict: true }`), client không gửi `slug`, trùng slug → 409 rõ ràng, không tự thêm hậu tố.
- Product được tạo **không bắt buộc có variant nào** — variant thêm sau qua endpoint riêng.
- Đổi `name` (PATCH) → sinh lại slug theo tên mới, cùng quy tắc trùng → 409 (như Category §Q9).

### 4.3 `ProductVariant`

- `sku` (bắt buộc, unique, **client tự đặt** — không server-generate, vì SKU theo quy ước riêng của từng store, khác slug), `color`/`size` (optional), `price` (decimal, bắt buộc), `status` (`ACTIVE`/`INACTIVE`, default `ACTIVE`).
- Trùng `sku` → 409.
- `productId` lấy từ path param `:id`, không phải từ body.

### 4.4 Tạo Inventory kèm Variant

**Quyết định (đã chốt qua brainstorming):** `ProductsModule` tự tạo dòng `inventory` (quantity=0, reserved_quantity=0) trong **cùng transaction Prisma** với việc tạo `ProductVariant`, đúng theo ghi chú ở Mục 3 tài liệu kiến trúc ("dòng inventory sinh ra cùng ProductVariant của nó"). Inventory module (Phase 4) chỉ thêm API đọc/điều chỉnh (`GET`/`PATCH /inventory/:variantId/adjust`) lên dòng đã tồn tại này — không phải nơi tạo dòng đầu tiên. Đây là ngoại lệ tường minh với "quyền sở hữu dữ liệu giữa các module" ở Mục 2 (Inventory sở hữu ghi bảng `inventory`) — cần ghi lại rõ trong code (comment) rằng đây là chủ đích, không phải module Products "lấn" qua Inventory.

```typescript
// Ví dụ hình dạng transaction trong ProductsService.createVariant()
await this.prisma.$transaction(async (tx) => {
  const variant = await tx.productVariant.create({ data: { ...dto, productId } });
  await tx.inventory.create({ data: { variantId: variant.id, quantity: 0, reservedQuantity: 0 } });
  return variant;
});
```

### 4.5 Xoá Product / Variant

Schema hiện tại đã có `onDelete: Cascade` từ `ProductVariant`/`ProductImage` → `Product`, và từ `Inventory` → `ProductVariant` — xoá Product cascade xoá variant + inventory của nó, không cần thêm logic chặn nào ở Phase 2 (khác với Category→Product, vốn dùng RESTRICT có chủ đích — ADR 0001). Lý do khác biệt: Cart/Order (nơi thật sự cần bảo vệ dữ liệu lịch sử) chưa tồn tại ở Phase 2, nên chưa có rủi ro mất dữ liệu giao dịch khi xoá variant/product. **Cần rà soát lại quyết định này khi Cart (Phase 4) và Orders (Phase 5) được build** — lúc đó `cart_items`/`order_items` có thể tham chiếu variant, và cascade delete từ Product có thể cần đổi thành RESTRICT giống Category, hoặc chặn ở tầng service.

## 5. Testing

- Unit test `ProductsService`: sinh slug đúng, 409 khi trùng `name`/`slug`, 404 khi `categoryId` không tồn tại, transaction tạo variant+inventory (mock `$transaction`, assert cả 2 lệnh `create` được gọi).
- Unit test `ProductVariant`-related methods: 409 khi trùng `sku`, 404 khi `productId` không tồn tại.
- E2e test theo đúng pattern `categories.e2e-spec.ts` — login MASTER_ADMIN thật qua `POST /api/v1/auth/login`, test 401/403 (role sai)/404/409/201 cho cả Product và Variant endpoint. Thêm 1 test xác nhận `GET /inventory` (nếu Phase 4 đã build) hoặc trực tiếp query DB xác nhận dòng `inventory` được tạo đúng sau `POST .../variants`.

## 6. Error handling

Theo đúng pattern Categories: pre-check + `409`/`404` rõ ràng ở service, chưa có `PrismaExceptionFilter` global (gap đã ghi nhận ở Categories plan, không phải gap mới của module này — race condition giữa 2 request tạo trùng `sku`/`slug` gần như đồng thời có thể rơi xuống Prisma `P2002` → 500 thay vì 409; rủi ro thấp cho test tuần tự, thật nếu có traffic đồng thời).

## 7. Cấu trúc thư mục

Theo đúng convention hiện có (`docs/convention/coding-style-conventions.md` §2) — module phẳng, subfolder chỉ khi ≥2 file cùng vai trò:

```
src/products/
├── products.module.ts
├── products.controller.ts       # cả Product và Variant route (nested resource, cùng controller)
├── products.service.ts
├── products.service.spec.ts
└── dto/
    ├── create-product.dto.ts
    ├── update-product.dto.ts
    ├── create-variant.dto.ts
    ├── update-variant.dto.ts
    └── pagination.dto.ts         # copy-paste giống Categories — đây là module thứ 2 dùng, chưa tới ngưỡng 3-4 module để tách chung (quyết định đã ghi ở Mục 3 tài liệu kiến trúc)
```

Không tạo `src/inventory/` trong phạm vi này — module đó thuộc Phase 4, tạo khi tới lượt nó.
