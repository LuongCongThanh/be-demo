# Report 19

- **PR:** #
- **Ngày merge:**

## Đã làm

- Migration `20261113120000_unaccent_search`: `CREATE EXTENSION IF NOT EXISTS unaccent`.
- `product-search.query.ts`: SQL lọc, tìm kiếm, sắp xếp, phân trang cho storefront (Prisma không sắp theo `MIN()` của quan hệ và không gọi được `unaccent`). `ProductService.findAll` lấy id + khoảng giá theo trang rồi đọc Sản phẩm bằng Prisma, giữ thứ tự của SQL. Tham số đều đi qua `Prisma.sql` (không nối chuỗi).
- `ListProductsQueryDto` thêm `q`, `minPrice`, `maxPrice`, `sort`; DTO mới `ProductListItemResponseDto` (`minPrice`, `maxPrice`) và `PaginatedProductListResponseDto`.
- `AdminListProductsQueryDto` kế thừa `PaginationDto` thay vì DTO storefront; thêm `q` (tên hoặc SKU, `contains` + `insensitive`).
- `docs/openapi/openapi.json` sinh lại.

## Lệch so với spec và rủi ro còn lại

- Tìm kiếm ở admin không bỏ dấu (Prisma `contains`); storefront mới bỏ dấu. Đủ cho back-office vì có thể tìm theo SKU.
- Chưa có index cho tìm kiếm (`unaccent` không IMMUTABLE nên không index trực tiếp được); quét bảng chấp nhận được với quy mô MVP.
- Danh mục chỉ lọc đúng `categoryId`, chưa gồm danh mục con (giữ nguyên hành vi cũ).

## Test cũ đã chạm

| File                                                  | Thay đổi                                                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/catalog/product/product.service.spec.ts` | Xoá 2 test kiểm hình dạng `where` của Prisma trong `findAll` (hành vi đã thay bằng SQL). Phase 7 viết lại bằng test tích hợp trên DB thật cho `findAll`. |

Không có test mới.

## Kiểm tra

- `npm run typecheck`, `npm run lint` (chỉ còn warning cũ `no-explicit-any`), `npm run test` (238 pass), `npm run build`, `npm run openapi:write` pass.

## Acceptance criteria: chạy tay trên API local

Postgres 17 + Redis 8 docker throwaway (`b1-pg` :55439, `b1-redis` :56389), `prisma migrate deploy` + `prisma/seed.ts`, API `node dist/main.js` cổng 8080. Đổi tên hai Sản phẩm seed bằng SQL để có tên tiếng Việt: "Áo Thun Cotton Đen", "Quần 100%_Linen".

```
-- all (newest)      total 10 | Canvas Tote Bag 150000 ; Leather Belt 290000 ; … ; Classic Cotton T-Shirt 199000
-- price_asc limit 5 total 10 | Canvas Tote Bag 150000 ; Classic Cotton T-Shirt 199000 ; Leather Belt 290000 ; Oversized Polo Shirt 320000 ; Linen Short Sleeve Shirt 390000
-- price_desc        total 10 | Leather Loafers 1200000 ; Running Sneakers 890000 ; Straight Leg Jeans 550000
-- q blank           total 10
-- minPrice=200000&maxPrice=300000  total 1 | Leather Belt 290000
-- size=M            total 4
-- sort=bestseller   400 "sort must be one of the following values: newest, price_asc, price_desc"
-- limit=2&page=2    Leather Loafers ; Running Sneakers
q=shirt       → 3 Linen Short Sleeve Shirt ; Oversized Polo Shirt ; Slim Fit Dress Shirt
q=ao thun     → 1 Áo Thun Cotton Đen
q=ÁO TH       → 1 Áo Thun Cotton Đen
q=den         → 1 Áo Thun Cotton Đen
q=đen         → 1 Áo Thun Cotton Đen
q=100%_       → 1 Quần 100%_Linen
q=100%x       → 0
q=_           → 1 Quần 100%_Linen
admin q=cotton → 1 Áo Thun Cotton Đen
admin q=tshirt → 1 Áo Thun Cotton Đen   (theo SKU)
admin q=SNEAK  → 1 Running Sneakers
admin size=M   → 400 "property size should not exist"
```
