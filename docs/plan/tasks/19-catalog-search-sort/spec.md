---
status: done
pr: #
blocked-by: []
labels: [ready-for-agent]
---

# Spec 19: Tìm kiếm, sắp xếp và lọc giá danh sách Sản phẩm

Branch: `feature/catalog-search-sort` · Slice B1 (Catalog) của tái cấu trúc ba repo. Không viết test mới (Phase 7); xác minh bằng typecheck, lint, build, Swagger và chạy tay. Test cũ chỉ sửa cơ chế, test của hành vi đã bỏ thì xoá và ghi lại cho Phase 7.

## Problem Statement

Storefront cần trang danh sách, danh mục và tìm kiếm đọc từ API. `GET /products` chỉ lọc theo danh mục, size, màu và luôn trả mới nhất trước: không tìm theo tên (BR-CAT-13), không sắp theo giá, không lọc giá, và mỗi dòng không có giá nên thẻ sản phẩm không hiện được giá. CMS cần ô tìm kiếm ở danh sách Sản phẩm.

## Solution

- `GET /products` thêm:
  - `q`: chuỗi con của tên, không phân biệt hoa thường và dấu tiếng Việt (extension `unaccent`), bỏ khoảng trắng đầu/cuối, rỗng là không lọc; `%` và `_` là ký tự thường.
  - `minPrice`, `maxPrice`: lọc theo giá thấp nhất của các Biến thể ACTIVE.
  - `sort`: `newest` (mặc định), `price_asc`, `price_desc`; sắp theo giá thấp nhất của các Biến thể ACTIVE. `bestseller` (BR-CAT-12) để slice C vì cần Đơn hàng.
  - Mỗi dòng thêm `minPrice`, `maxPrice` (VND số nguyên). Response đổi sang `PaginatedProductListResponseDto`.
  - Sản phẩm ACTIVE không còn Biến thể ACTIVE nào không hiện trong danh sách (không có gì để mua).
- `GET /admin/products`: query DTO tách khỏi DTO storefront; thêm `q` tìm theo tên hoặc SKU (không phân biệt hoa thường). Bỏ `size`, `color` vốn bị bỏ qua.
- Khi B2 thêm Giá khuyến mãi, "giá" trong lọc và sắp đổi thành giá áp dụng.
- Sinh lại `docs/openapi/openapi.json`; tag `openapi-v0.3.0` phát hành sau PR upload ảnh.

## Acceptance criteria

- Chạy tay: `q=ao thun` và `q=ÁO TH` đều tìm thấy "Áo Thun Cotton Đen"; `q=den` và `q=đen` cũng vậy; `q=_` chỉ khớp tên có `_`; `q` toàn khoảng trắng trả đủ danh sách.
- `sort=price_asc` / `price_desc` đúng thứ tự, phân trang ổn định; `sort=bestseller` → 400.
- `minPrice`/`maxPrice` lọc đúng; `size=M` vẫn lọc như cũ.
- Admin `q=tshirt` tìm theo SKU, `q=cotton` theo tên; `size=M` ở admin → 400.
