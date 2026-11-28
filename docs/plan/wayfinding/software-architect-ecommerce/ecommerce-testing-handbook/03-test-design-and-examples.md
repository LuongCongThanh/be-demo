# Test design và ví dụ

**Trạng thái:** Nháp (tài liệu tham khảo).

## Decision table: voucher (giả định không stacking)

| Active | Đủ min spend | Còn quota | Kết quả |
| ------ | ------------ | --------- | ------- |
| Có     | Có           | Có        | Áp dụng |
| Không  | Có           | Có        | Từ chối |
| Có     | Không        | Có        | Từ chối |
| Có     | Có           | Không     | Từ chối |

Boundary: min spend 500000 VND → 499999, 500000, 500001. Clock: trước, đúng, sau expiry theo quy ước exclusive end. Property: tổng discount không vượt eligible subtotal; tổng phân bổ bằng discount sau làm tròn.

## Pseudocode: cạnh tranh SKU cuối cùng

```text
seed SKU with available = 1
start two independent transactions / clients behind a barrier
submit checkout A and B concurrently with different keys
wait for both outcomes
assert exactly one successful reservation
assert available == 0
assert reserved == 1
assert no negative stock and no orphan order
```

Dùng database thật với isolation tương đương production; barrier có timeout; không giả lập concurrency bằng hai lệnh tuần tự. Điều chỉnh assertion nếu hệ thống cho backorder.

## Pseudocode: webhook idempotency

```text
seed pending order with expected amount and currency
send valid signed success event twice (same provider event ID)
assert payment succeeded exactly once
assert order confirmed according to policy
assert one logical fulfillment event
assert ledger amount equals expected amount
send invalid signature for another pending order
assert no payment or order state change
```

Kiểm tra cả hai event khác ID nhưng cùng giao dịch nếu provider có thể gửi như vậy. Outbox delivery có thể at-least-once; consumer phải idempotent.

## Mutation example

`available >= quantity` đổi thành `available > quantity`. Test quantity bằng available phải FAIL khi mutant được áp dụng. Test thêm quantity âm, zero và vượt tồn ở boundary validation phù hợp.

## Failure injection

| Fault                                   | Expected invariant                         |
| --------------------------------------- | ------------------------------------------ |
| DB lỗi giữa order và reservation        | Không partial commit                       |
| Provider timeout sau khi đã nhận charge | Không charge lại mù quáng; query/reconcile |
| Worker chết sau publish trước ack       | Retry không tạo side effect logic trùng    |
| Cache unavailable                       | Fallback hoặc fail an toàn theo policy     |
| Webhook đến muộn                        | Reconcile, không tự ý bỏ qua tiền đã thu   |
