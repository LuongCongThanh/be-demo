---
status: Draft
owner: Backend
last_verified: 2026-09-23
dependencies: [07-orders.md]
---

# 08 — Payments specification

MoMo là MVP provider sau provider-neutral adapter. Payment có nhiều Attempts nhưng tối đa một successful outcome cho amount due.

Browser redirect không xác nhận thanh toán. Chỉ signed IPN đã verify hoặc reconciliation result được chuyển Payment sang success. Handler phải chịu duplicate, out-of-order và late-success. Raw provider payload phục vụ audit nhưng secret/PII phải được redact khỏi logs.

MVP hỗ trợ full refund qua STORE_MANAGER review, không partial refund. Trước implementation phải đối chiếu tài liệu MoMo sandbox hiện hành, chốt signature/request mapping, timeout/retry, reconciliation và contract tests.
