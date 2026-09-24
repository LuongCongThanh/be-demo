---
decision_status: accepted
implementation_status: planned
decided_at: 2026-09-17
last_verified: 2026-09-23
related_spec: ../specs/08-payments.md
---

# Dùng MoMo làm payment provider đầu tiên đưa vào production

MVP hướng tới thị trường Việt Nam sẽ xử lý VND qua MoMo, đứng sau một ranh giới `PaymentProvider` trung lập (không gắn cứng vào một provider cụ thể). PayPal được lùi lại làm provider quốc tế cho giai đoạn sau, còn Stripe nằm ngoài phạm vi trừ khi doanh nghiệp có pháp nhân hợp lệ tại một quốc gia mà Stripe hỗ trợ; việc đưa MoMo vào production còn phụ thuộc vào hợp đồng merchant, UAT, các chi tiết settlement và reconciliation, quy trình refund/khiếu nại, và thông tin xác thực (credentials) production.

Chưa implement: chưa có Payment schema/module/provider adapter hoặc sandbox contract tests.
