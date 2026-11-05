# Module `cart`

> Trạng thái: **Bản nháp cho tái cấu trúc** ([quy ước](../../README.md#trạng-thái-tài-liệu)). Bảng: [`../../database-design.md`](../../database-design.md). Ranh giới: [`../02-modules.md`](../02-modules.md). Nguồn nghiệp vụ: [business/04](../../business/04-business-rules.md) §4 (BR-CRT-*), [business/03](../../business/03-user-stories.md) E2.

## 1. Trách nhiệm

- Sở hữu: Giỏ hàng server-side cho Khách hàng và Khách vãng lai, gộp giỏ khi đăng nhập.
- Không Giữ hàng (BR-INV-03); giá trong giỏ luôn là Giá áp dụng hiện tại (BR-CRT-04).

## 2. Mô hình

| Bảng | Ghi chú |
|---|---|
| `carts` | `user_id?` hoặc `guest_token_hash?` (đúng một trong hai), `status` `ACTIVE`/`CHECKED_OUT`/`MERGED`, `last_activity_at`; partial unique một giỏ `ACTIVE` cho mỗi chủ |
| `cart_items` | Unique `(cart_id, variant_id)`, `quantity` 1–10 (BR-CRT-05), `price_seen` (Giá áp dụng lúc thêm — chỉ để báo đổi giá, không dùng để tính tiền) |

## 3. Interface cho module khác

| Hàm | Dùng bởi |
|---|---|
| `lockActiveCart(owner, tx)` → giỏ + dòng | `ordering` (đặt đơn, [ADR 0009](../../adr/0009-cart-row-lock-over-optimistic-version.md)) |
| `markCheckedOut(cartId, tx)` | `ordering` |
| `mergeGuestCart(guestToken, userId)` | `identity` sau đăng nhập |

## 4. API

| Method | Path | Actor | Ghi chú |
|---|---|---|---|
| `GET` | `/cart` | guest, customer | Giá hiện tại, cờ đổi giá, Biến thể hết hàng/`archived` (US-202) |
| `POST` | `/cart/items` | guest, customer | Kẹp theo Số lượng bán được và 10 (US-201) |
| `PATCH/DELETE` | `/cart/items/:variantId` | guest, customer | |

Khách vãng lai nhận cookie `HttpOnly` chứa token giỏ ở lần ghi đầu tiên; server chỉ lưu hash.

## 5. Luồng

### 5.1. Gộp giỏ (BR-CRT-03, US-204)

Một transaction: khoá giỏ vãng lai và giỏ Tài khoản theo `id` tăng dần (ADR 0009) → với mỗi dòng vãng lai, cộng dồn vào giỏ Tài khoản, kẹp `min(tổng, Số lượng bán được, 10)` → giỏ vãng lai `MERGED` → trả danh sách dòng bị kẹp để báo Người mua.

## 6. Sự kiện

Không phát, không nghe.

## 7. Job

| Job | Tần suất | Hành vi |
|---|---|---|
| Xoá giỏ vãng lai | Mỗi ngày | Giỏ `guest` có `last_activity_at` quá 30 ngày (BR-CRT-02) |

## 8. Bao phủ

BR-CRT-01–05, BR-INV-03; US-201–204; ADR 0009.

## 9. Câu hỏi mở

- Giỏ Khách hàng có hết hạn không? Business chỉ quy định giỏ vãng lai — đề xuất: không.
