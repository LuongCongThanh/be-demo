# 04. Tính nhất quán dữ liệu

> Trạng thái: **Đã chốt cho MVP**. Nguồn nghiệp vụ: [`../business/04-business-rules.md`](../business/04-business-rules.md), [`../business/05-order-lifecycle.md`](../business/05-order-lifecycle.md). Schema: [`./11-database.md`](./11-database.md).

## 1. Nguyên tắc

- PostgreSQL là nguồn dữ liệu duy nhất cho trạng thái thương mại (Order, Tồn kho, Giữ hàng, Thanh toán, Hoàn tiền, Voucher). Redis chỉ là cache/rate-limit/queue ([ADR 0008](../adr/0008-redis-outage-degrades-not-unready.md)).
- Mỗi chuyển trạng thái nghiệp vụ là **một transaction**: thay đổi aggregate + bộ đếm Tồn kho + bản ghi lịch sử (BR-INV-09, audit back-office) + dòng outbox ([ADR 0003](../adr/0003-inventory-reservations-and-transactional-outbox.md)). Side effect bên ngoài (email, GHN, Cổng thanh toán) chỉ chạy sau commit, qua outbox ([07-async-events-jobs.md](./07-async-events-jobs.md) mục 2).
- Ưu tiên **conditional update một câu lệnh** (`UPDATE ... WHERE <điều kiện> RETURNING`) thay cho đọc-rồi-ghi; 0 dòng bị ảnh hưởng nghĩa là thua cuộc đua → từ chối hoặc đi nhánh xử lý riêng.
- Số tiền là số nguyên VND; không dùng số thực (BR-CAT-04, BR-VCH-10).
- Thời điểm so hạn dùng `clock_timestamp()`, không dùng `now()` (cố định từ đầu transaction, sai khi phải chờ lock).

## 2. Ba đại lượng Tồn kho

| Đại lượng | Ý nghĩa | Nguồn |
|---|---|---|
| Tồn kho (`on_hand`) | Hàng có thể bán theo Biến thể × Kho (MVP một Kho) | BR-INV-01 |
| Giữ hàng | Bản ghi `inventory_reservations` có hạn 15 phút, chỉ cho đơn online chưa thanh toán | BR-INV-05, ADR 0003 |
| Hàng chờ xuất | Phần đã trừ Tồn kho nhưng chưa Bàn giao, theo Mã đơn × Biến thể | BR-INV-10, [ADR 0010](../adr/0010-stock-decremented-at-order-awaiting-dispatch.md) |

- **Số lượng bán được** = Tồn kho − tổng Giữ hàng `active` còn hạn (BR-INV-02). Lưu bộ đếm `reserved` trên dòng tồn kho để đọc O(1); bộ đếm và bản ghi Giữ hàng luôn đổi trong cùng transaction.
- **Hàng trên kệ** = Tồn kho + Hàng chờ xuất (dùng cho Kiểm kê, BR-INV-12).
- Ràng buộc DB: `on_hand >= 0`, `reserved >= 0`, `reserved <= on_hand`; số lượng dòng > 0.
- Giỏ hàng không chạm Tồn kho (BR-INV-03).

### 2.1. Chuyển động Tồn kho theo sự kiện

| Sự kiện | Giữ hàng | Tồn kho | Hàng chờ xuất |
|---|---|---|---|
| Đặt đơn COD (T2) | — | `−qty` có điều kiện | `+qty` |
| Đặt đơn online (T1) | tạo `active`, `reserved += qty` | — | — |
| Thanh toán thành công (T3) | `active → converted`, `reserved −= qty` | `−qty` | `+qty` |
| Hết hạn / huỷ chưa thanh toán (T4, T5) | `active → expired/released`, `reserved −= qty` | — | — |
| Huỷ trước Đang giao (T7, T9) | — | `+qty` | `−qty` (BR-INV-07) |
| Vận đơn tạo xong (T10) | — | — | xoá dòng của đơn |
| Hoàn hàng / Đổi trả nhập lại (BR-INV-08) | — | `+qty` khi Staff xác nhận, **một lần** (idempotent theo đơn/yêu cầu); movement `return_to_sender` (Hoàn hàng) / `return_restock` (Đổi trả) | — |
| Nhập kho, điều chỉnh, Kiểm kê (US-701..703) | — | `±qty`, giảm không vượt Số lượng bán được (BR-INV-11) | — |

Mọi dòng trên ghi một bản ghi sổ biến động (loại, số lượng, đơn liên quan, người thực hiện — BR-INV-09).

### 2.2. Trừ/giữ có điều kiện

Mỗi Biến thể của đơn được giữ/trừ bằng một câu lệnh:

```sql
UPDATE inventory_levels
SET reserved = reserved + :qty            -- hoặc on_hand = on_hand - :qty với COD
WHERE variant_id = :v AND warehouse_id = :w
  AND on_hand - reserved >= :qty
RETURNING on_hand - reserved AS available;
```

Các dòng được khoá theo **`variant_id` tăng dần** để hai đơn chung nhiều Biến thể không deadlock. Bất kỳ dòng nào trả 0 dòng → rollback toàn bộ, trả danh sách Biến thể thiếu và số còn lại (BR-INV-06). Hai người cùng mua món cuối: câu lệnh của B bị chặn bởi row lock của A, đánh giá lại sau khi A commit và thua; nếu A rollback thì B thắng.

## 3. Cuộc đua thanh toán ↔ hết hạn Giữ hàng

Xử lý theo `business/05-order-lifecycle.md` §4.1. Khi nhận IPN/Đối soát thành công (đã qua dedup, BR-PAY-03) và số tiền khớp (BR-PAY-04):

1. Khoá dòng Order (`SELECT ... FOR UPDATE`).
2. Nếu Order `PENDING_PAYMENT`:
   - `UPDATE inventory_reservations SET status='converted' WHERE order_id=:o AND status='active' AND expires_at > clock_timestamp()` — tất cả dòng của đơn cùng lúc.
   - Đủ dòng → T3.
   - Không đủ (đã quá hạn nhưng job chưa huỷ) → thử trừ lại theo §2.2; được thì T3, không được thì T4 rồi coi như đơn đã huỷ.
3. Nếu Order không còn `PENDING_PAYMENT` (đã huỷ, hoặc đã `PLACED` bởi Thanh toán khác) → giữ nguyên Order, tạo yêu cầu Hoàn tiền + Cờ cần xử lý, phát `ordering.unexpected-payment-received` (BR-PAY-05). IPN lặp của chính Thanh toán đã đưa đơn vào `PLACED` thì bỏ qua.

Job huỷ đơn quá hạn (T4) cũng khoá dòng Order và chỉ huỷ khi vẫn `PENDING_PAYMENT`, nên hai bên tuần tự hoá trên cùng một khoá; job tạm dừng khi hàng đợi IPN dồn ứ (§4.1).

## 4. Giỏ hàng

- Checkout và mọi thao tác sửa giỏ đều `SELECT ... FOR UPDATE` dòng `carts` và yêu cầu `status='active'` ([ADR 0009](../adr/0009-cart-row-lock-over-optimistic-version.md)). Checkout chuyển `active → checked_out` trong cùng transaction tạo Order, nên checkout thứ hai trên cùng giỏ (khác Idempotency-Key) thua.
- Gộp giỏ khi đăng nhập (BR-CRT-03): khoá **cả hai** giỏ theo `id` tăng dần, cộng dồn số lượng, cắt theo `min(Số lượng bán được, 10)` (BR-CRT-05), đóng giỏ vãng lai (`merged`).
- Ràng buộc unique `(cart_id, variant_id)`; số lượng 1..10.

## 5. Hoàn tiền

- Tổng các Hoàn tiền `requested` + `refunded` của một Thanh toán ≤ số tiền thực nhận (`payments.amount_captured`) (BR-REF-06, [ADR 0006](../adr/0006-manual-refund-mvp-scope.md)). Kiểm tra trong transaction **có khoá dòng Thanh toán**, không dựa vào check constraint (cần tổng nhiều dòng).
- Mỗi thao tác nghiệp vụ tạo Hoàn tiền được định danh ổn định bằng `(payment_id, reason, return_id)` với UK `NULLS NOT DISTINCT` trên `refunds` (ví dụ huỷ: `(p, order_cancelled, null)`, tiền về ngoài dự kiến: `(p, unexpected_payment, null)`, Đổi trả: `(p, return_accepted, r)`) → xử lý lại không tạo yêu cầu thứ hai.
- Đổi trả nhiều lần: số hoàn tính lũy kế theo BR-RET-07 từ `voucher_discount` đã chụp ([ADR 0012](../adr/0012-order-line-snapshot-and-voucher-allocation.md)), không tính lại từ giá hiện tại.

## 6. Lượt dùng Voucher

- Lượt dùng ghi bằng một dòng `voucher_usages(voucher_id, order_id, user_id?, phone)` **trong transaction tạo đơn** (BR-VCH-08).
- Tổng lượt: khoá dòng `vouchers` (`FOR UPDATE`) rồi đếm, hoặc bộ đếm `used_count` tăng có điều kiện `WHERE used_count < total_limit`.
- Lượt theo Người mua (BR-VCH-07): đếm usage còn hiệu lực có `user_id = :u OR phone = :p`, trong cùng transaction sau khi đã khoá dòng Voucher — để hai đơn song song của cùng một người không cùng lọt.
- Trả lượt khi huỷ trước Đang giao (T4, T5, T7, T9): đặt `voucher_usages.released_at` trong transaction huỷ và giảm bộ đếm. T14 **không** trả lượt.

## 7. Mã đơn

- Định dạng `FS<YYMM>-` + 6 ký tự ngẫu nhiên từ bảng chữ không dễ nhầm, sinh bằng CSPRNG (BR-ORD-03). Không dùng sequence (lộ thứ tự/số lượng).
- Unique index trên `orders.code`; trùng (xác suất rất thấp) → sinh lại và thử lại trong cùng request, tối đa vài lần.
- Khoá nội bộ vẫn là UUID; Mã đơn chỉ dùng hiển thị và tra cứu ([ADR 0011](../adr/0011-guest-identity-by-order-code-and-phone.md)).

## 8. Idempotency

- `POST` đặt đơn và tạo link thanh toán bắt buộc header `Idempotency-Key`; lưu `(scope, key) → request hash + response` trong PostgreSQL ([03-api.md](./03-api.md)). Cùng key khác body → `409` ([11-database.md](./11-database.md) `idempotency_keys`).
- IPN dedup theo UK `payment_notifications(gateway, dedup_key)` (BR-PAY-03); thông báo GHN dedup theo UK `shipment_events(shipment_id, dedup_key)` (`dedup_key` dựng từ mã sự kiện/trạng thái + thời điểm GHN).
- Consumer của outbox phải idempotent ([ADR 0007](../adr/0007-outbox-done-means-downstream-ack.md)).
