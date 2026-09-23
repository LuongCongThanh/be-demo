---
decision_status: accepted
implementation_status: planned
decided_at: 2026-09-17
last_verified: 2026-09-23
related_spec: ../specs/05-inventory.md
---

# Outbox chỉ hoàn tất thành công sau downstream acknowledgement

Một dòng outbox chỉ hoàn tất thành công (`ACKNOWLEDGED`) khi downstream xác nhận tác dụng phụ của nó; enqueue vào BullMQ không phải completion. Nếu dùng hết retry mà chưa có acknowledgement, dòng chuyển thành `DEAD_LETTER`, vẫn có thể quan sát/replay và không được gọi là "done". Nếu Redis làm mất job sau enqueue nhưng trước khi worker chạy, reconciliation sweep phải phát hiện dòng đang chờ acknowledgement và phục hồi nó.

Chưa implement: chưa có Outbox schema, worker, acknowledgement protocol hoặc reconciliation sweep. Retention và dedup key theo consumer vẫn là quyết định implementation còn mở.
