---
decision_status: accepted
implementation_status: partial
decided_at: 2026-09-17
last_verified: 2026-09-23
related_spec: ../specs/05-inventory.md
---

# Redis mất kết nối chỉ làm suy giảm tính năng, không bao giờ đánh dấu API replica là unready

Readiness probe của một replica chỉ phụ thuộc vào PostgreSQL; Redis bị down không bao giờ loại một replica khỏi load balancer. Thay vào đó, mỗi tính năng phụ thuộc Redis tự suy giảm theo cách riêng của nó — các route bị rate-limit fail closed với `503`, cache rơi về (fallback) PostgreSQL — trong khi mọi thứ dựa trên PostgreSQL, kể cả payment webhook, vẫn tiếp tục hoạt động. Việc gắn readiness với Redis đã bị loại bỏ vì nó sẽ khiến toàn bộ replica bị đưa ra khỏi dịch vụ chỉ vì một dependency thuộc loại cache/rate-limit, một phạm vi ảnh hưởng (blast radius) lớn hơn nhiều so với mức độ quan trọng của dependency đó, và trực tiếp mâu thuẫn với cam kết rằng việc mất Redis không được làm mất trạng thái thương mại (commercial state).

Readiness chỉ phụ thuộc PostgreSQL đã được implement và test. Redis-backed rate limit/cache/BullMQ chưa được wire, nên các degradation behavior tương ứng vẫn là planned.
