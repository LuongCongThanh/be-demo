---
status: Draft
owner: Backend
last_verified: 2026-09-23
dependencies: [07-orders.md, 08-payments.md, 10-fulfillment.md]
---

# 11 — Notifications specification

Mail hiện tại chỉ phục vụ Auth. Notification module tương lai consume versioned domain events, tạo delivery attempts và gửi qua provider adapters.

Trước worker cần chốt event schema, consumer dedup key, retry/backoff, dead-letter/replay, template/version, recipient preference và sensitive-data policy. Notification failure không được rollback transaction nghiệp vụ đã commit.
