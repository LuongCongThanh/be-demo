---
decision_status: accepted
implementation_status: planned
decided_at: 2026-09-17
last_verified: 2026-09-23
related_spec: ../specs/05-inventory.md
---

# Dùng inventory reservation tường minh và transactional outbox

Checkout sẽ biểu diễn mỗi lần giữ hàng có thời hạn dưới dạng một Inventory Reservation trong PostgreSQL, và ghi các domain event vào một outbox trong cùng transaction với Order và các thay đổi trên stock aggregate. Cách này tốn thêm độ phức tạp về schema và worker so với việc chỉ cập nhật `reserved_quantity` hoặc publish trực tiếp lên BullMQ, nhưng đổi lại có được khả năng kiểm chứng hết hạn (auditable expiry), phục hồi an toàn, và giao event theo kiểu at-least-once trên nhiều instance API mà không cần biến Redis thành nguồn dữ liệu chính.

Chưa implement: schema hiện chỉ có Inventory counters; chưa có Inventory Reservation, Outbox hoặc worker.
