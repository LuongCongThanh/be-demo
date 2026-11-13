# Report 21

- **PR:**
- **Ngày merge:**

## Đã làm

- `GET /products/slug/:slug`: dùng chung truy vấn chi tiết với `GET /products/:id` (`findDetail`), chỉ Sản phẩm ACTIVE và Biến thể ACTIVE.
- Enum `Gender`, cột `products.gender` (migration `20261113150000_product_gender`, mặc định `UNISEX` cho dữ liệu cũ). `CreateProductDto.gender` bắt buộc; `UpdateProductDto` override để `null` bị 400.
- `GET /products?gender=`: nhiều giá trị, MEN/WOMEN gộp UNISEX (BR-CAT-14).
- `categoryId` lọc cả danh mục con, cháu bằng CTE đệ quy (BR-CAT-15).
- GLOSSARY (Giới tính), BR-CAT-14, BR-CAT-15, US-102 AC5, `03-api.md`.

## Kiểm tay (API local, DB docker throwaway)

- Đặt 3 Sản phẩm thành MEN/WOMEN/KIDS: `gender=MEN` → 1 MEN + 8 UNISEX; `gender=WOMEN` → 1 WOMEN + 8 UNISEX; `gender=KIDS` → chỉ 1 KIDS; `gender=MEN&gender=KIDS` → MEN, KIDS, UNISEX.
- `gender=X`, `PATCH {"gender":"ALIEN"}`, `PATCH {"gender":null}`, tạo thiếu `gender` → 400.
- `/products/slug/leather-belt` → 200 kèm 2 Biến thể; slug lạ và slug của Sản phẩm DRAFT → 404.
- Tạo danh mục con dưới "Shoes", chuyển "Running Sneakers" vào: lọc theo "Shoes" vẫn ra "Running Sneakers".

## Lệch so với spec và rủi ro còn lại

- Review (`/code-review`): `PATCH {"gender":null}` trả 500 (sửa bằng override); CTE đổi `UNION ALL` → `UNION` để dừng nếu cây danh mục lỡ có vòng; so sánh `gender` theo kiểu enum thay vì ép text.
- **Breaking:** client tạo Sản phẩm không gửi `gender` bị 400. CMS cần thêm ô Giới tính trước khi lên contract `openapi-v0.5.0`.

## Test cũ đã chạm

| File                                                                                              | Thay đổi                                                   |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `admin-product.service.spec.ts`, `create-product.dto.spec.ts`                                     | Payload tạo thêm `gender: 'UNISEX'`.                       |
| `test/products.e2e-spec.ts`, `test/categories.e2e-spec.ts`, `test/admin-sizes-colors.e2e-spec.ts` | Payload tạo thêm `gender: 'UNISEX'`; assertion giữ nguyên. |
