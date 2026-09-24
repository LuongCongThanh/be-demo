---
status: Draft
owner: Backend
last_verified: 2026-09-23
dependencies: [07-orders.md]
---

# 09 — Promotions specification

MVP chấp nhận tối đa một coupon-code Promotion cho mỗi Order. Promotion validation trả kết quả tại Checkout; Order phải snapshot `subtotal`, `discount_amount` và thông tin Promotion áp dụng.

Trước implementation cần chốt loại discount, rounding, min-spend, validity window/timezone, usage limit, concurrency và error semantics. Promotion không được sửa lại lịch sử Order sau khi snapshot đã tạo.
