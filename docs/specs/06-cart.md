---
status: Draft
owner: Backend
last_verified: 2026-09-23
dependencies: [03-products.md, 05-inventory.md]
---

# 06 — Cart specification

Cart biểu diễn ý định mua hiện tại của Customer; Cart không giữ Inventory.

## Scope và contract

Customer đọc Cart, thêm/cập nhật/xóa Cart Item và clear Cart của chính mình. Item tham chiếu một active Product Variant cùng desired quantity. API phải bảo vệ ownership và không expose Cart của User khác.

## Invariants

- Một active Cart cho mỗi Customer theo policy triển khai.
- Một Variant xuất hiện tối đa một lần trong Cart; add lặp cập nhật quantity theo contract đã chốt.
- Quantity dương và có ceiling chống abuse.
- Giá/availability hiển thị chỉ là current view; Checkout luôn revalidate.
- Cart mutation và Checkout tranh chấp được giải quyết bằng Cart row lock theo ADR 0009.

## Implementation order

Chốt lifecycle/error semantics → migration/index nếu cần → service/ownership → HTTP/OpenAPI → unit/E2E → concurrent mutation-vs-checkout tests.
