# Module `catalog`

> Trạng thái: **Bản nháp cho tái cấu trúc** ([quy ước](../../README.md#trạng-thái-tài-liệu)). Bảng: [`../../database-design.md`](../../database-design.md). Ranh giới: [`../02-modules.md`](../02-modules.md). Nguồn nghiệp vụ: [business/04](../../business/04-business-rules.md) §1 (BR-CAT-*), [business/03](../../business/03-user-stories.md) E1, E8.

## 1. Trách nhiệm

- Sở hữu: Danh mục nhiều cấp, Sản phẩm, Biến thể size × màu, danh sách size, bảng màu, ảnh theo màu, tìm kiếm/lọc/sắp xếp storefront, số liệu bán chạy.
- Không sở hữu: Giá khuyến mãi (`pricing`), Tồn kho (`inventory`). Storefront hiển thị "Hết hàng" (BR-CAT-08) bằng cách hỏi `inventory`.

## 2. Mô hình

| Bảng | Ghi chú |
|---|---|
| `categories` | `parent_id?` (cây nhiều cấp), `sort_order`, tên tiếng Việt (BR-CAT-10); xoá theo [ADR 0001](../../adr/0001-category-delete-restrict.md) |
| `products` | `status` `draft`/`active`/`archived` (BR-CAT-07), `weight_grams` bắt buộc (BR-CAT-06), `name_search` (bỏ dấu, lowercase) cho BR-CAT-13 |
| `sizes`, `colors` | Dùng chung; size có `sort_order`; màu có mã, tên, hex; `hidden` thay cho xoá khi đã dùng (BR-CAT-11) |
| `product_variants` | Unique `(product_id, size_id, color_id)` (BR-CAT-02); `sku` unique toàn hệ thống, khoá sau khi có đơn (BR-CAT-03); `price` số nguyên VND > 0 (BR-CAT-04); `archived` |
| `product_images` | Gắn `(product_id, color_id)` (BR-CAT-05), `sort_order`, khoá object storage |
| `product_sales_stats` | Số lượng bán 30 ngày theo Sản phẩm, cập nhật mỗi đêm (BR-CAT-12) |

## 3. Interface cho module khác

| Hàm | Dùng bởi |
|---|---|
| `getSellableVariants(ids, tx?)` → tên, SKU, size, màu, Giá bán, cân nặng, trạng thái | `cart`, `ordering` (bản chụp), `pricing` |
| `assertVariantSellable(id)` | `cart` (US-202 AC2) |
| `markSkuLocked(variantIds, tx)` | `ordering` khi tạo đơn đầu tiên chứa Biến thể |

## 4. API

| Method | Path | Actor | Ghi chú |
|---|---|---|---|
| `GET` | `/categories` | mọi người | Cây danh mục |
| `GET` | `/products` | mọi người | `category`, `size`, `color`, `priceMin/Max` (theo Giá áp dụng), `q`, `sort` = `newest`/`price_asc`/`price_desc`/`best_selling` (US-101–103) |
| `GET` | `/products/:slug` | mọi người | Biến thể, ảnh theo màu, Giá áp dụng, còn hàng (US-104) |
| `CRUD` | `/admin/categories` | admin | US-801 |
| `CRUD` | `/admin/products`, `/admin/products/:id/variants` | admin | US-802; sinh ma trận Biến thể |
| `POST` | `/admin/products/:id/publish` · `/archive` | admin | US-803 |
| `POST` | `/admin/products/:id/images` | admin | Upload lên object storage, gắn màu |
| `CRUD` | `/admin/sizes`, `/admin/colors` | admin | US-805; xoá → ẩn nếu đã dùng |

## 5. Luồng

### 5.1. Tìm kiếm (BR-CAT-13)

Chuẩn hoá từ khoá: trim, lowercase, bỏ dấu tiếng Việt (gồm `đ → d`); rỗng → không lọc. Truy vấn `name_search LIKE '%' || :q || '%'` có index trigram (`pg_trgm`), kết hợp với bộ lọc và sắp xếp. Không fuzzy.

### 5.2. Xoá và lưu trữ

Sản phẩm/Biến thể đã có trong đơn không xoá cứng, chỉ `archived` (BR-CAT-09). Danh mục còn Sản phẩm hoặc Danh mục con → `409` kèm số lượng (ADR 0001).

## 6. Sự kiện

| Phát | Nghe |
|---|---|
| — | `ordering.order-placed`, `ordering.order-paid` không cần; số bán chạy tính từ `order_items` bằng job |

## 7. Job

| Job | Tần suất | Hành vi |
|---|---|---|
| Tính bán chạy | Mỗi đêm | Tổng số lượng Dòng đơn hàng của đơn đã vào `PLACED`, chưa huỷ, không Hoàn hàng, trong 30 ngày (BR-CAT-12) → `product_sales_stats` |

## 8. Bao phủ

BR-CAT-01–13; US-101–104, US-801–803, US-805; ADR 0001.

## 9. Câu hỏi mở

- Đọc dữ liệu đơn cho job bán chạy: qua view do `ordering` cung cấp hay đặt job ở `reporting`? Đề xuất: `reporting` tính và ghi qua interface của `catalog`.
