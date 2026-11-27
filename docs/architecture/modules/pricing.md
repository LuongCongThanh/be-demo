# Module `pricing`

> Trạng thái: **Bản nháp cho tái cấu trúc** ([quy ước](../../README.md#trạng-thái-tài-liệu)). Bảng: [`../11-database.md`](../11-database.md). Ranh giới: [`../02-modules.md`](../02-modules.md). Nguồn nghiệp vụ: [business/04](../../business/04-business-rules.md) §2 (BR-PRC-_, BR-VCH-_), [business/03](../../business/03-user-stories.md) US-804, E9.

## 1. Trách nhiệm

- Sở hữu: Giá khuyến mãi, Voucher, lượt dùng Voucher; tính Giá áp dụng và số tiền giảm của Voucher.
- Phân bổ Voucher về Dòng đơn hàng do `ordering` làm ([ordering.md](./ordering.md) §6, [ADR 0012](../../adr/0012-order-line-snapshot-and-voucher-allocation.md)); `pricing` chỉ trả tổng giảm `D`.

## 2. Mô hình

Chi tiết cột, ràng buộc, enum: [`../11-database.md` §4.3](../11-database.md#43-pricing-promotions).

- `sale_prices` — Giá khuyến mãi theo khoảng thời gian
- `vouchers` — Voucher
- `voucher_usages` — lượt dùng Voucher theo đơn

## 3. Interface cho module khác

| Hàm                                                                                          | Dùng bởi                                                     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `getEffectivePrices(variantIds, at)` → Giá bán, Giá áp dụng, mức giảm (BR-PRC-03, BR-PRC-04) | `cart`, `catalog`, `ordering`                                |
| `evaluateVoucher(code, subtotal, buyer{userId?, phone})` → `D` hoặc lý do từ chối            | `ordering` (Tính thử)                                        |
| `recordUsage(voucherId, orderId, buyer)` / `releaseUsage(orderId)`                           | `ordering` (T1/T2; T4/T5/T7/T9 — không gọi ở T14, BR-VCH-08) |
| `assertPriceChangeAllowed(variantId, newPrice)`                                              | `catalog` (BR-PRC-05)                                        |

## 4. API

| Method                           | Path                                     | Actor                                 | Ghi chú                                                                                                               |
| -------------------------------- | ---------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `GET`, `POST`                    | `/admin/products/:productId/sale-prices` | `PRICING_SALE_PRICE_VIEW` / `_MANAGE` | US-804; tạo cho một hoặc nhiều Biến thể, theo số tiền hoặc %                                                          |
| `PATCH`, `DELETE`                | `/admin/sale-prices/:id`                 | `PRICING_SALE_PRICE_MANAGE`           | BR-PRC-06                                                                                                             |
| `POST`                           | `/admin/sale-prices/:id/end`             | `PRICING_SALE_PRICE_MANAGE`           | Kết thúc ngay Giá khuyến mãi đang hiệu lực                                                                            |
| `GET`, `POST`, `PATCH`, `DELETE` | `/admin/vouchers`, `/admin/vouchers/:id` | `PRICING_VOUCHER_VIEW` / `_MANAGE`    | US-901; mã không đổi; đã có lượt dùng chỉ đổi kết thúc, giới hạn lượt, bật/tắt; chỉ xoá Voucher chưa dùng (BR-VCH-11) |

Áp Voucher phía storefront đi qua Tính thử của `ordering` (`POST /checkout/quotes`), không có endpoint "validate" riêng.

## 5. Luồng

### 5.1. Tính giảm Voucher (BR-VCH-10)

Số nguyên: `percent` → `min((subtotal * value) // 100, max_discount ?? ∞, subtotal)`; `fixed` → `min(value, subtotal)`. Chỉ trên Tạm tính, không trên phí ship (BR-VCH-05).

### 5.2. Ghi lượt dùng (BR-VCH-07, BR-VCH-08)

Trong transaction đặt đơn: `SELECT … FOR UPDATE` dòng `vouchers` → kiểm tra hiệu lực, `used_count < total_limit`, số usage chưa `released` có `user_id = :userId OR phone = :phone` < `per_buyer_limit` → insert usage, `used_count += 1`. Trả lượt: set `released_at`, `used_count -= 1`. Chi tiết khoá: [04-data-consistency](../04-data-consistency.md).

## 6. Sự kiện

Không phát; được gọi đồng bộ trong `TransactionRunner.run()` của `ordering`; adapter của `pricing` nhập vào giao dịch đó.

## 7. Job

Không có.

## 8. Bao phủ

BR-PRC-01–05, BR-VCH-01–10; US-304, US-804, US-901.

## 9. Câu hỏi mở

- Voucher hết hạn giữa Tính thử và đặt đơn → `409 QUOTE_CHANGED` (đã đúng theo ADR 0013); không cần quy tắc riêng.

## As-built — triển khai hiện tại (2026-11-21)

Mục tiêu phía trên là contract kiến trúc; runtime hiện có hai phần chưa thành một interface `pricing`: sale price được đăng ký cùng `catalog` trong `CatalogModule`, còn Voucher có `VoucherModule` riêng. Cả hai dùng Prisma trực tiếp. Sale price được `ProductService` gọi bằng helper query giá đang hiệu lực; `AdminProductService` gọi guard để đồng bộ thay đổi Giá bán. Không có provider/port công khai cho các module khác.

### API hiện tại

| Method            | Path                                     | Hành vi hiện tại                                                                                       |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET`, `POST`     | `/admin/products/:productId/sale-prices` | Liệt kê hoặc tạo cho một/nhiều Biến thể; tạo theo Giá hoặc phần trăm giảm.                             |
| `PATCH`, `DELETE` | `/admin/sale-prices/:id`                 | Sửa lịch sắp tới/thời điểm kết thúc đang hiệu lực; chỉ xóa lịch chưa bắt đầu.                          |
| `POST`            | `/admin/sale-prices/:id/end`             | Kết thúc Giá khuyến mãi đang hiệu lực ngay.                                                            |
| `GET`, `POST`     | `/admin/vouchers`, `/admin/vouchers/:id` | Liệt kê/đọc và tạo Voucher.                                                                            |
| `PATCH`, `DELETE` | `/admin/vouchers/:id`                    | Sửa và xóa Voucher chưa có lượt dùng; Voucher đã dùng chỉ cho phép sửa một số trường hoặc vô hiệu hóa. |

Sale-price routes thuộc `AdminSalePriceController` trong `CatalogModule`; Voucher routes thuộc `AdminVoucherController` trong `VoucherModule`. Cả hai dùng permission `PRICING_*_VIEW/MANAGE`. Trong các module được khảo sát không có route áp mã/validate Voucher phía storefront.

### Kiểm kê runtime theo file

Các đường dẫn sau là toàn bộ 23 file TypeScript không phải spec trong `src/modules/catalog/pricing/**` và `src/modules/voucher/**`.

#### Sale price

| File                                                                           | Trách nhiệm, symbol chính và phụ thuộc đáng kể                                                                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/modules/catalog/pricing/controllers/admin/admin-sale-price.controller.ts` | `AdminSalePriceController`: list/create/update/end/delete qua các admin routes; gọi `AdminSalePriceService`, authorization và DTO.                                       |
| `src/modules/catalog/pricing/domain/active-sale-prices.ts`                     | `ActiveSalePrice`, `findActiveSalePrices`: query khoảng thời gian đang hiệu lực cho các variant, trả map; nhận `PrismaService` từ caller.                                |
| `src/modules/catalog/pricing/domain/sale-price-guards.ts`                      | `isSalePriceOverlap`, `lockVariants`, `assertPriceAboveSalePrices`: xử lý overlap/lock và bảo vệ Giá bán trước giá sale; được gọi trực tiếp bởi pricing/product service. |
| `src/modules/catalog/pricing/domain/sale-price-status.ts`                      | `SALE_PRICE_STATUSES`, `SalePriceStatus`, `salePriceStatus`, `priceAfterPercentOff`: trạng thái theo thời điểm và làm tròn giá phần trăm.                                |
| `src/modules/catalog/pricing/dto/admin/create-sale-price.dto.ts`               | `CreateSalePriceDto`: input tạo lịch cho một/nhiều variant, validator/Swagger.                                                                                           |
| `src/modules/catalog/pricing/dto/admin/sale-price-response.dto.ts`             | `SalePriceResponseDto`: response lịch sale, dùng `SalePriceStatus`.                                                                                                      |
| `src/modules/catalog/pricing/dto/admin/update-sale-price.dto.ts`               | `UpdateSalePriceDto`: input sửa lịch sale, validator/Swagger.                                                                                                            |
| `src/modules/catalog/pricing/services/admin/admin-sale-price.service.ts`       | `AdminSalePriceService`: quản lý lịch sale, validation/transaction/lock/overlap và lifecycle; Prisma, DTO, guard/status helpers.                                         |

#### Voucher

| File                                                                | Trách nhiệm, symbol chính và phụ thuộc đáng kể                                                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/modules/voucher/admin/controllers/admin-voucher.controller.ts` | `AdminVoucherController`: admin list/read/create/update/delete; `Authorize`, `CurrentUser`, `Permission`, gọi `AdminVoucherService`.                                     |
| `src/modules/voucher/admin/dto/create-voucher.dto.ts`               | `CreateVoucherDto`: input Voucher; dùng `VoucherType` của domain và validation/Swagger.                                                                                  |
| `src/modules/voucher/admin/dto/list-vouchers-query.dto.ts`          | `ListVouchersQueryDto`: pagination, query và status; phụ thuộc `PaginationDto`/`VoucherStatus`.                                                                          |
| `src/modules/voucher/admin/dto/paginated-voucher-response.dto.ts`   | `PaginatedVoucherResponseDto`: response trang voucher, ghép pagination metadata và response item.                                                                        |
| `src/modules/voucher/admin/dto/update-voucher.dto.ts`               | `UpdateVoucherDto`: input cập nhật, mở rộng `CreateVoucherDto`.                                                                                                          |
| `src/modules/voucher/admin/dto/voucher-response.dto.ts`             | `VoucherResponseDto`: response gồm usedCount và status; dùng `VoucherType`/`VoucherStatus` của domain.                                                                   |
| `src/modules/voucher/application/admin-voucher.service.ts`          | `AdminVoucherService` (không export): CRUD back-office, khóa row khi sửa/xóa và bảo vệ trường sau khi đã dùng; qua `VoucherRepository` và `TransactionRunner`.           |
| `src/modules/voucher/application/voucher.service.ts`                | `VoucherService` (public, export): `evaluate` kiểm điều kiện áp mã và trả snapshot, `recordUsage` tăng `usedCount` và ghi `voucher_usages`. Checkout chưa gọi (task 46). |
| `src/modules/voucher/application/ports/voucher.repository.ts`       | `VoucherRepository` (abstract class): mọi đọc/ghi `vouchers`, `voucher_usages`, gồm khóa dòng theo `id`/`code`.                                                          |
| `src/modules/voucher/domain/voucher.model.ts`                       | `Voucher`, `VoucherType`, `VoucherSnapshot` và các kiểu input của Voucher; tiền là `number`.                                                                             |
| `src/modules/voucher/domain/voucher-rules.ts`                       | Hàm thuần: `assertTerms`, `changedFields`, `isApplicable`, `toSnapshot`, `safeAmount`.                                                                                   |
| `src/modules/voucher/domain/voucher-status.ts`                      | `VOUCHER_STATUSES`, `VoucherStatus`, `voucherStatus`: phân loại active/upcoming/ended/exhausted/disabled.                                                                |
| `src/modules/voucher/infrastructure/prisma-voucher.repository.ts`   | `PrismaVoucherRepository`: adapter Prisma của `VoucherRepository` qua `TransactionHost`; map bản ghi sang `Voucher`.                                                     |
| `src/modules/voucher/infrastructure/voucher-status-where.ts`        | `voucherStatusWhere`: tạo Prisma filter theo trạng thái, khớp `voucherStatus`.                                                                                           |
| `src/modules/voucher/voucher.module.ts`                             | `VoucherModule`: đăng ký controller/service với Passport, bind `VoucherRepository` và export `VoucherService`.                                                           |

### Target so với hiện tại

| Chủ đề           | Target contract                                                                        | Hiện trạng quan sát được                                                                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Effective price  | `getEffectivePrices(variantIds, at)` được gọi bởi cart/catalog/ordering.               | Không có function/provider với contract đó. Có `findActiveSalePrices` trong pricing; storefront gọi helper này cho detail và `productSearchSql` tự ghép `sale_prices` để lọc/sắp xếp danh sách.                                                                                          |
| Giá bán và sale  | `assertPriceChangeAllowed(variantId, newPrice)` là interface của pricing cho catalog.  | Không có symbol đó; `AdminProductService` gọi trực tiếp `assertPriceAboveSalePrices` và `lockVariants` từ file guard của pricing.                                                                                                                                                        |
| Voucher          | `evaluateVoucher`, `recordUsage`, `releaseUsage` phục vụ ordering và Tính thử/đặt đơn. | Có `VoucherService.evaluate` và `recordUsage` (task 42) nhưng checkout chưa gọi (đổi ở task 46); chưa có `releaseUsage` hay endpoint storefront. `AdminVoucherService` không tăng `usedCount` hay ghi `VoucherUsage` — chỉ đọc counter hiện có để tính trạng thái và khóa chỉnh sửa/xóa. |
| Ranh giới module | Target gộp Giá khuyến mãi, Voucher và lượt dùng trong `pricing`.                       | Sale price nằm dưới `catalog/pricing` và được wiring trong `CatalogModule`; CRUD Voucher nằm trong module riêng. Chưa có interface xuyên module để che Prisma hoặc gom hai phần này.                                                                                                     |

## Test inventory

Không có unit spec (`*.spec.ts`) dưới `src/modules/catalog/pricing/` hoặc `src/modules/voucher/`. Các test catalog-specific trong những thư mục e2e đã xác định được liệt kê theo từng file ở [`catalog.md`](./catalog.md#test-inventory); không đưa test identity/cross-cutting vào inventory này.
