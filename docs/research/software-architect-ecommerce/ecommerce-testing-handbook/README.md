# E-commerce Testing Handbook — Production-ready Edition

**Trạng thái:** Nháp (tài liệu tham khảo).

Tài liệu độc lập framework, bổ trợ Unified Handbook. 138 scenario theo 11 nhóm nghiệp vụ, 5 sơ đồ có PNG/SVG/Mermaid/DOT. Các ví dụ là đề xuất chưa chạy trên repository thực tế. Mở Markdown Preview trong VS Code sau giải nén.

## Mục lục

- [01-strategy](01-strategy.md)
- [02-accounts](02-accounts.md)
- [02-cart](02-cart.md)
- [02-catalog](02-catalog.md)
- [02-checkout](02-checkout.md)
- [02-cms](02-cms.md)
- [02-inventory](02-inventory.md)
- [02-payment](02-payment.md)
- [02-pricing](02-pricing.md)
- [02-returns](02-returns.md)
- [02-search](02-search.md)
- [02-shipping](02-shipping.md)
- [03-test-design-and-examples](03-test-design-and-examples.md)
- [04-frontend-backend-e2e](04-frontend-backend-e2e.md)
- [05-nonfunctional](05-nonfunctional.md)
- [06-quality-and-ci](06-quality-and-ci.md)
- [07-templates-and-ai](07-templates-and-ai.md)
- [08-master-checklist](08-master-checklist.md)

## Áp dụng

Bắt đầu strategy, xác nhận business rules, chọn module, lập traceability, triển khai P0 trước, chạy quality gates và audit định kỳ. Master checklist là index lặp có chủ đích để theo dõi tiến độ. Ví dụ tích hợp VNPay/MoMo/GHN, Google OAuth, email có thể áp dụng contract/sandbox tương ứng; không giả định chi tiết API provider.
