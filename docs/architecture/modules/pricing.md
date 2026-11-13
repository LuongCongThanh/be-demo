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
| `recordUsage(voucherId, orderId, buyer, tx)` / `releaseUsage(orderId, tx)`                   | `ordering` (T1/T2; T4/T5/T7/T9 — không gọi ở T14, BR-VCH-08) |
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

Không phát; được gọi đồng bộ trong transaction của `ordering`.

## 7. Job

Không có.

## 8. Bao phủ

BR-PRC-01–05, BR-VCH-01–10; US-304, US-804, US-901.

## 9. Câu hỏi mở

- Voucher hết hạn giữa Tính thử và đặt đơn → `409 QUOTE_CHANGED` (đã đúng theo ADR 0013); không cần quy tắc riêng.
