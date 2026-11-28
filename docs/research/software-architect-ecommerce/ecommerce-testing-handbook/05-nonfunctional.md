# Security, performance, resilience và vận hành

**Trạng thái:** Nháp (tài liệu tham khảo).

| Nhóm             | Kịch bản                                                                                         | Bằng chứng                                              |
| ---------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Security         | BOLA/IDOR, RBAC, XSS, injection, CSRF khi dùng cookie, SSRF, upload, mass assignment, rate limit | Negative API, scan và review                            |
| Payment security | Signature, replay, secret rotation, không lưu CVV, không log card data                           | Contract và log audit; PCI scope do chuyên gia xác định |
| Privacy          | Export, masking, retention, consent, log redaction                                               | Access matrix, data lifecycle test                      |
| Performance      | Browse/search, flash sale, checkout, webhook burst, CMS export                                   | p95/p99, error rate, throughput, DB saturation theo SLO |
| Resilience       | DB/cache/queue/provider lỗi, retry storm, timeout, circuit breaker                               | Fault injection, recovery và reconciliation             |
| Migration        | Schema mới trên dữ liệu đại diện, compatibility rolling deploy                                   | Migration rehearsal, backup restore                     |
| Accessibility    | Keyboard, focus, labels, contrast, screen reader checkout                                        | Automated + manual review                               |
| SEO              | Canonical, redirects, robots, sitemap, product structured data                                   | Crawl và rendered HTML                                  |

Không đặt ngưỡng tải tùy tiện: xác định traffic peak, workload mix, SLO, RPO/RTO với team. Load test trên môi trường được phép; không gây tải provider thật. Monitoring: order/payment mismatch, negative inventory, stuck reservations, webhook lag, queue DLQ, checkout error rate, refund mismatch. Alert có owner và runbook. Production smoke không tạo charge thật hoặc làm sai số liệu kinh doanh.
