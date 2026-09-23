---
status: Draft
owner: Backend
last_verified: 2026-09-23
dependencies: [07-orders.md, 08-payments.md]
---

# 10 — Fulfillment specification

Fulfillment quản lý physical handling và delivery của Order đã đủ điều kiện; không trộn với Payment status hoặc Order commercial snapshot.

Trước implementation phải chốt state machine, actor permissions, cancellation boundary, shipment/tracking model, shipping-provider adapter, retry/reconciliation và các event status-changed. Module phải giữ audit trail cho staff actions.
