# Plan 06: Gộp catalog thành một module

Branch: `chore/catalog-module` (từ `dev`). Một PR, commit `refactor: merge catalog folders into a single CatalogModule`.

Hướng dẫn thực hiện: [guide.md](./guide.md). Kết quả: [report.md](./report.md).

## Bảng di chuyển file (54 file, đã đối chiếu `find`)

Mọi `x.spec.ts` đi cùng `x.ts` (kể cả dto spec → `dto/`).

| Hiện tại                                                                                                      | Đích (`src/modules/catalog/…`)                                |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `categories/categories.module.ts`, `products/products.module.ts`, `product-options/product-options.module.ts` | **xoá** → `catalog.module.ts` (mới)                           |
| `categories/categories.controller.ts`                                                                         | `controllers/storefront/categories.controller.ts`             |
| `products/products.controller.ts`                                                                             | `controllers/storefront/products.controller.ts`               |
| `product-options/product-options.controller.ts`                                                               | `controllers/storefront/product-options.controller.ts`        |
| `categories/admin-categories.controller.ts`                                                                   | `controllers/back-office/admin-categories.controller.ts`      |
| `products/admin-products.controller.ts`                                                                       | `controllers/back-office/admin-products.controller.ts`        |
| `product-options/admin-product-options.controller.ts`                                                         | `controllers/back-office/admin-product-options.controller.ts` |
| `categories/{categories,admin-categories}.service.ts`, `category-tree.ts`                                     | gốc module                                                    |
| `products/{products,admin-products,admin-product-images}.service.ts`, `variant-response.mapper.ts`            | gốc module                                                    |
| `products/admin-products-lifecycle.service.spec.ts` (test cho `admin-products.service.ts`)                    | gốc module                                                    |
| `product-options/product-options.service.ts`                                                                  | gốc module                                                    |
| `categories/dto/*`, `products/dto/*`, `product-options/dto/*` (gồm `option-code.decorator.ts`)                | `dto/*` — không trùng tên file                                |

`catalog.module.ts` (giữ thứ tự controller như trong từng module cũ):

```ts
@Module({
  imports: [AuthModule],
  controllers: [
    CategoriesController,
    AdminCategoriesController,
    ProductsController,
    AdminProductsController,
    ProductOptionsController,
    AdminProductOptionsController,
  ],
  providers: [
    CategoriesService,
    AdminCategoriesService,
    ProductsService,
    AdminProductsService,
    AdminProductImagesService,
    ProductOptionsService,
  ],
})
export class CatalogModule {}
```

`app.module.ts`: bỏ `CategoriesModule` (dòng 9), `ProductsModule` (13), `ProductOptionsModule` (15); đặt `CatalogModule` tại vị trí `CategoriesModule` cũ.

## Các bước

1. [x] Trên `dev`, ghi metric "trước" vào [metric.md](./metric.md): số file test (`find src -name '*.spec.ts' | wc -l`), số test (output `npm test`). Lưu Swagger: chạy app với env dev + `SWAGGER_ENABLED=true` (`docker compose up -d` cho DB), `curl localhost:$PORT/docs-json > <scratchpad>/swagger-before.json`.
2. [x] `git mv` theo bảng trên (giữ lịch sử).
3. [x] Viết lại import: thay `#src/categories/`, `#src/products/`, `#src/product-options/` → `#src/modules/catalog/` + `controllers/storefront/` / `controllers/back-office/` / `services/` / `dto/` đúng chỗ. Gồm cả chuỗi trong `vi.mock(...)` (typecheck không bắt).
4. [x] Tạo `catalog.module.ts`; sửa `app.module.ts` như trên.
5. [x] Chạy AC3 grep; `lint`, `typecheck`, `test`, `test:e2e` — không sửa assertion; so số file test/số test với metric "trước".
6. [x] Swagger "sau" → `diff <(jq -S . before) <(jq -S . after)` rỗng.
7. [x] Docs: 02-modules §4 "Hiện tại" — sửa câu "module để phẳng dưới `src/`…", thêm `modules/catalog/`, bỏ dòng `categories/ products/`.
       7b. [x] Gom `storefront/` + `back-office/` vào `controllers/` (`git mv`, sửa import `#src/modules/catalog/controllers/...`); sửa `coding-style §2.2/§2.6`, `02-modules §4`; verify lại lint/typecheck/test/e2e + Swagger diff. Tạo task 07 cho `auth`/`staff`.
8. [ ] Ghi metric "sau"; `/code-review`; `/ship`.
9. [ ] Sau merge: `report.md`, `status: done`, `pr: #NN` trong spec + bảng tổng.

## Rủi ro

- **Thứ tự route**: gộp module đổi thứ tự đăng ký so với `StaffModule`. Chỉ nguy hiểm nếu route tĩnh/động đè nhau — e2e + Swagger diff (đã sắp xếp) bắt được thay đổi nội dung.
- **`vi.mock` path sai** chỉ lỗi lúc chạy test → bước 3 + AC3 grep.
- **ESM/DI load-order** (coding-style §3): không barrel, import `#src/...` tới file thật.
