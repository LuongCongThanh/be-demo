# Module `catalog`

> Trạng thái: **Bản nháp cho tái cấu trúc** ([quy ước](../../README.md#trạng-thái-tài-liệu)). Bảng: [`../11-database.md`](../11-database.md). Ranh giới: [`../02-modules.md`](../02-modules.md). Nguồn nghiệp vụ: [business/04](../../business/04-business-rules.md) §1 (BR-CAT-*), [business/03](../../business/03-user-stories.md) E1, E8.

## 1. Trách nhiệm

- Sở hữu: Danh mục nhiều cấp, Sản phẩm, Biến thể size × màu, danh sách size, bảng màu, ảnh theo màu, tìm kiếm/lọc/sắp xếp storefront, số liệu bán chạy.
- Không sở hữu: Giá khuyến mãi (`pricing`), Tồn kho (`inventory`). Storefront hiển thị "Hết hàng" (BR-CAT-08) bằng cách hỏi `inventory`.

## 2. Mô hình

Chi tiết cột, ràng buộc, enum: [`../11-database.md` §4.2](../11-database.md#42-catalog).

- `categories` — cây Danh mục
- `products` — Sản phẩm
- `sizes`, `colors` — danh sách size/màu dùng chung
- `product_variants` — Biến thể size × màu, mang SKU và Giá bán
- `product_images` — ảnh theo màu
- `product_sales_stats` — số liệu bán chạy 30 ngày

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

Chuẩn hoá từ khoá: trim, lowercase, bỏ dấu tiếng Việt (gồm `đ → d`); rỗng → không lọc. Truy vấn `search_name LIKE '%' || :q || '%'` (cột generated, index GIN trigram `pg_trgm`), kết hợp với bộ lọc và sắp xếp. Không fuzzy.

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
