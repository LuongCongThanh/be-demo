# Report 22

- **PR:**
- **Ngày merge:**

## Đã làm

- Model `SalePrice`, migration `20261113180000_sale_prices` (btree_gist, CHECK giá > 0 và kết thúc > bắt đầu, exclusion `sale_prices_no_overlap`, cấp 2 Quyền mới cho Admin).
- `catalog/pricing/`: `AdminSalePriceService` + controller, trạng thái tính theo thời điểm request, `findActiveSalePrices`, `assertPriceAboveSalePrices` (BR-PRC-05, gọi từ `updateVariant`).
- Truy vấn danh sách storefront dùng `COALESCE(giá khuyến mãi đang hiệu lực, Giá bán)`.
- BR-PRC-06, US-804 AC4–AC5, `modules/pricing.md` §4.

## Kiểm tay (API local, DB docker throwaway)

- 20% cho 2 Biến thể (249.000, 199.000) → 199.200, 159.200, ACTIVE.
- Trùng thời gian → 409 kèm SKU; giá ≥ Giá bán → 400; gửi cả `price` và `percentOff` → 400; bắt đầu trong quá khứ → 400.
- Storefront: `onSale=true` chỉ ra Sản phẩm đó (`minPrice` 159.200, `minRegularPrice` 199.000, `maxDiscountPercent` 20); `sort=discount_desc` đưa nó lên đầu; `maxPrice=160000` ra Sản phẩm này nhờ Giá áp dụng; chi tiết có `effectivePrice`, `salePrice`.
- Hạ Giá bán xuống bằng Giá khuyến mãi → 409. Đang hiệu lực: đổi giá 409, kéo dài kết thúc 200, xoá 409. Sắp diễn ra: sửa 200, xoá 204. Kết thúc ngay → ENDED; sửa/xoá sau đó → 409.
- 5 request tạo trùng cùng lúc → 1×201, 4×409. Ghi thẳng một dòng trùng bằng Prisma → `PrismaClientKnownRequestError`, được nhận ra là trùng thời gian (→ 409).
- Hạ Giá bán xuống 1.000 và tạo Giá khuyến mãi 5.000 cùng lúc → một bên 409; không còn dòng Giá khuyến mãi nào ≥ Giá bán.
- Biến thể đã ngừng bán → 400.

## Lệch so với spec và rủi ro còn lại

- Review (`/code-review`): kiểm BR-PRC-01/05 rồi mới ghi có thể chạy đua → tạo, sửa Giá khuyến mãi và đổi Giá bán đều chạy trong transaction có `SELECT … FOR UPDATE` trên dòng Biến thể; sửa Giá khuyến mãi luôn kiểm lại giá < Giá bán; chặn Biến thể đã ngừng bán; nhận lỗi trùng thời gian không còn `JSON.stringify` thô (BigInt làm ném lỗi).
- `maxDiscountPercent` làm tròn xuống: giảm dưới 1% hiện 0 dù `onSale` đúng; storefront ẩn nhãn khi 0.
- `GET /products/:id/variants` và `…/variants/:variantId` (storefront) chưa trả Giá áp dụng; storefront không dùng hai route này.
- Thay đổi Giá khuyến mãi chưa ghi audit log.

## Test cũ đã chạm

| File                                                                 | Thay đổi                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| `product.service.spec.ts`, `admin-product-lifecycle.service.spec.ts` | Thêm stub `salePrice` vào mock Prisma; assertion giữ nguyên. |
