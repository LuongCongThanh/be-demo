---
status: done
pr:
blocked-by: [20-product-image-upload]
labels: [ready-for-agent]
---

# Spec 21: Tìm Sản phẩm theo slug, Giới tính, lọc theo danh mục con

Branch: `feature/product-slug-gender` · Slice B1 (Catalog). Không viết test mới (Phase 7); xác minh bằng typecheck, lint, build, Swagger và chạy tay. Test cũ chỉ sửa fixture.

## Problem Statement

Storefront dùng slug trong URL trang chi tiết, nhưng API chỉ tìm Sản phẩm theo UUID. Storefront lọc theo giới tính, API không có trường này. Trang danh mục cha (ví dụ "Áo") không hiện gì vì `categoryId` chỉ khớp đúng danh mục.

## Solution

- `GET /products/slug/:slug`: cùng response và cùng quy tắc hiển thị với `GET /products/:id` (chỉ ACTIVE, Biến thể ACTIVE); không thấy → 404.
- Enum `Gender` (`MEN`, `WOMEN`, `KIDS`, `UNISEX`), cột `products.gender` NOT NULL, Sản phẩm đã có nhận `UNISEX` (BR-CAT-14).
- `POST /admin/products` bắt buộc `gender`; `PATCH` sửa được; mọi response Sản phẩm có `gender`.
- `GET /products?gender=MEN&gender=KIDS`: lọc nhiều giá trị; `MEN`/`WOMEN` gộp `UNISEX`.
- `GET /products?categoryId=` gồm cả danh mục con, cháu (BR-CAT-15).
- Sau khi merge: tag `openapi-v0.5.0`.

## Acceptance criteria

- `GET /products/slug/{slug}` của Sản phẩm ACTIVE → 200 có `variants`, `images`, `gender`; DRAFT/ARCHIVED hoặc slug lạ → 404.
- Tạo Sản phẩm thiếu `gender` hoặc giá trị lạ → 400.
- Lọc `gender=MEN` trả Sản phẩm MEN và UNISEX, không có WOMEN/KIDS; `gender=KIDS` chỉ trả KIDS.
- Lọc theo danh mục cha trả cả Sản phẩm của danh mục con.
