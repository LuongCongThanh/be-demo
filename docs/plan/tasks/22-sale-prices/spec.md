---
status: done
pr:
blocked-by: [21-product-slug-gender]
labels: [ready-for-agent]
---

# Spec 22: Giá khuyến mãi

Branch: `feature/sale-prices` · Slice B2. Không viết test mới (Phase 7); xác minh bằng typecheck, lint, build, Swagger và chạy tay. Test cũ chỉ sửa mock.

## Problem Statement

Chưa có Giá khuyến mãi: Admin không đặt được giá giảm theo thời gian, storefront chỉ có Giá bán (US-804, US-101 AC1, US-102 AC3).

## Solution

- Bảng `sale_prices` (Biến thể, giá, `[startsAt, endsAt)`, người tạo). Exclusion constraint `btree_gist` chặn trùng thời gian trên cùng Biến thể (BR-PRC-02).
- Quyền `PRICING_SALE_PRICE_VIEW/MANAGE`, cấp cho Vai trò Admin trong migration; Staff không có.
- `GET/POST /admin/products/:productId/sale-prices`: tạo cho nhiều Biến thể một lần, `price` chung hoặc `percentOff` (làm tròn xuống đến đồng), cả lô hoặc không; giá phải < Giá bán (BR-PRC-01).
- `PATCH`, `DELETE /admin/sale-prices/:id`, `POST …/end` theo BR-PRC-06.
- Sửa Giá bán của Biến thể bằng hoặc thấp hơn Giá khuyến mãi đang hoặc sắp hiệu lực → 409 (BR-PRC-05).
- Storefront: danh sách lọc, sắp theo Giá áp dụng; thêm `minRegularPrice`, `maxDiscountPercent`, bộ lọc `onSale`, sắp `discount_desc`. Chi tiết: mỗi Biến thể có `effectivePrice`, `salePrice`.
- Sau khi merge: tag `openapi-v0.6.0`.

## Acceptance criteria

- Tạo 20% cho cả Sản phẩm → mỗi Biến thể một dòng, giá làm tròn xuống; trùng thời gian → 409; giá ≥ Giá bán → 400.
- Storefront: `minPrice` là Giá áp dụng; `onSale=true` chỉ ra Sản phẩm đang giảm; lọc giá theo Giá áp dụng.
- Đang hiệu lực: đổi giá → 409, đổi kết thúc → 200, xoá → 409, kết thúc ngay → ENDED. Sắp diễn ra: sửa, xoá được. Đã kết thúc: sửa/xoá → 409.
