---
status: Draft
owner: Backend
last_verified: 2026-09-23
dependencies: [06-cart.md, 05-inventory.md]
---

# 07 — Orders and Checkout specification

Order là immutable commercial snapshot được tạo từ Cart. Orders sở hữu checkout orchestration, Order/Order Items, financial/address snapshots và checkout idempotency.

## Checkout transaction

1. Lock Cart row.
2. Revalidate Variant, price, status và quantity.
3. Tính subtotal/discount/shipping/tax/currency.
4. Reserve Inventory.
5. Tạo Order snapshot và Items.
6. Ghi outbox event cùng transaction.
7. Đóng/clear Cart theo contract cuối.

## Invariants

- Checkout bắt buộc idempotency key: cùng key/cùng payload trả cùng kết quả; cùng key/khác payload là conflict.
- Order lịch sử không đọc lại giá/tên hiện tại để tính tổng.
- Không có partial Order nếu bất kỳ reservation/item nào thất bại.
- Staff/customer visibility và transition phải theo state machine được review.

## Implementation order

Chốt snapshot columns/state machine/idempotency recovery → migration → checkout transaction → read/admin APIs → outbox worker → duplicate/concurrency/crash-recovery E2E.
