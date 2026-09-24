# E-commerce Backend — Tài liệu tổng

Đây là điểm bắt đầu duy nhất để hiểu trạng thái, kiến trúc và thứ tự triển khai. Chi tiết nằm trong đúng một spec cho mỗi module tại [Module Specifications Index](specs/MODULE-SPECS.md).

Hai tài liệu nền được giữ lại để tham khảo chuyên sâu:

- [Kiến trúc và system design đầy đủ](ecommerce-backend-architecture-system-design.md)
- [Tổng quan PostgreSQL schema](ecommerce-postgresql-database-summary.md)

`CONTEXT.md` là glossary nghiệp vụ canonical. [ADR index](adr/ADR-INDEX.md) lưu quyết định khó đảo ngược và trạng thái implementation; `docs/convention` và `docs/skill-guide` được giữ theo yêu cầu.

## Kiến trúc

Hệ thống là NestJS modular monolith. PostgreSQL là nguồn xác thực giao dịch; Object Storage giữ media. Redis/BullMQ chỉ được đưa vào application khi Reservation, Outbox hoặc background jobs cần đến. API dùng `/api/v1`, Swagger ở `/docs`.

- Module theo domain với data ownership rõ ràng.
- Aggregate/invariant quan trọng được bảo vệ bằng PostgreSQL transaction.
- Retryable write phải có idempotency semantics.
- External side effect quan trọng đi qua transactional outbox/worker.
- Order là commercial snapshot; Cart không giữ Inventory.
- Schema rollout theo expand–migrate–contract.
- Chỉ tách microservice khi có bằng chứng về tải, domain hoặc team ownership.

## Trạng thái module

| Module            | Trạng thái thực tế         | Gap/việc kế tiếp                                                     |
| ----------------- | -------------------------- | -------------------------------------------------------------------- |
| Infrastructure    | Gần hoàn tất               | Xác minh Docker/remote CI; sửa wildcard warning; OpenAPI drift gate  |
| Auth              | Hoàn tất MVP               | SMTP external gate; review cookie/CSRF trước cross-origin production |
| Categories        | Hoàn tất                   | Không có blocker đã biết                                             |
| Products/Variants | Đã implement               | Option Value + SKU tự ghép đã xong (ADR 0011); OpenAPI snapshot      |
| Product Images    | Đã implement               | MinIO lifecycle test trong CI; S3 production checklist (spec 03)     |
| Users             | Chưa build                 | Module tiếp theo cần triển khai                                      |
| Inventory         | Chỉ có model/bootstrap row | Thiếu adjustment, Reservation và concurrency control                 |
| Cart              | Có model, chưa có module   | Làm sau Inventory foundation                                         |
| Orders            | Có model, chưa có module   | Thiếu checkout snapshot, idempotency và outbox                       |
| Payments          | Chưa model/build           | MoMo adapter, IPN, reconciliation, refund                            |
| Promotions        | Chưa model/build           | Cần Order subtotal/discount snapshot trước                           |
| Fulfillment       | Chưa build                 | Cần state machine và shipping boundary                               |
| Notifications     | Một phần qua Auth mail     | Chưa có queue, history hoặc domain-event consumers                   |

## Data ownership và invariant liên module

| Module     | Sở hữu chính                                                    |
| ---------- | --------------------------------------------------------------- |
| Auth       | Credential, verification/reset token, Session credential        |
| Users      | Profile, Account Status, role assignment, authorization version |
| Categories | Category                                                        |
| Products   | Product, Product Variant, Product Image                         |
| Inventory  | Inventory, Inventory Reservation                                |
| Cart       | Cart, Cart Item                                                 |
| Orders     | Order, Order Item, checkout workflow                            |
| Payments   | Payment, Payment Attempt, Refund                                |

Ngoại lệ có chủ đích: Products tạo Inventory quantity `0` cùng transaction khi tạo Variant; sau đó chỉ Inventory được thay đổi số lượng/reservation.

- Không hard-delete Variant đang được Cart Item hoặc Order Item tham chiếu.
- Cart không reserve hàng; Checkout mới tạo Reservation 15 phút.
- Reservation kết thúc đúng một lần: consumed, released hoặc expired.
- Order lưu snapshot giá, discount, phí, thuế, currency và địa chỉ.
- Payment có nhiều Attempts nhưng tối đa một successful outcome cho amount due.
- Role/status mutation làm token cũ mất hiệu lực qua authorization version.

## Thứ tự triển khai

1. P0: Product atomicity, wildcard compatibility, Docker/CI/S3 verification và OpenAPI drift.
2. Users: profile, role/status, audit và last-MASTER_ADMIN invariant.
3. Inventory: adjustment, Reservation, locking, expiry và outbox foundation.
4. Cart: customer cart; không reserve hàng.
5. Orders: checkout, snapshots, idempotency, reservation và outbox.
6. Payments: MoMo, signed IPN, reconciliation và full refund.
7. Promotions: một coupon/Order và discount snapshot.
8. Fulfillment + Notifications.
9. Chỉ sau đo đạc: cache, search, PayPal hoặc microservice extraction.

## Definition of Done

Module chỉ hoàn tất khi code đã wire, migration cần thiết đã test, unit/E2E/integration tests pass, OpenAPI/contract khớp, invariants có acceptance scenarios và không còn P0 correctness gap. Checkbox plan không phải bằng chứng.

Kiểm tra gần nhất ngày 2026-09-23: lint, typecheck, build, 199 unit tests và 108 E2E tests pass; một real-SMTP test được skip có chủ đích khi environment gate chưa bật.
