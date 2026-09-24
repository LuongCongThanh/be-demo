# Module specifications index

Mỗi module có đúng một spec chứa scope, contract, authorization, invariants, integration boundary, acceptance criteria và implementation order.

## Module đã có

| Module                          | Spec                                 | Trạng thái                        |
| ------------------------------- | ------------------------------------ | --------------------------------- |
| 01 — Auth                       | [01-auth.md](01-auth.md)             | Verified                          |
| 02 — Categories                 | [02-categories.md](02-categories.md) | Verified                          |
| 03 — Products, Variants, Images | [03-products.md](03-products.md)     | Implemented; còn P0 atomicity gap |

## Thứ tự ưu tiên triển khai

Trước Module 04 phải hoàn thành **P0 hardening**: sửa Product aggregate atomicity, wildcard compatibility và xác minh Docker/CI/S3/OpenAPI.

| Ưu tiên | Module                  | Spec                                       | Lý do phụ thuộc                                                  |
| ------- | ----------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| 04      | Users                   | [04-users.md](04-users.md)                 | Hoàn thiện staff administration, role/status và audit foundation |
| 05      | Inventory + Reservation | [05-inventory.md](05-inventory.md)         | Nền tảng chống oversell cho Cart/Checkout                        |
| 06      | Cart                    | [06-cart.md](06-cart.md)                   | Phụ thuộc catalog và Inventory boundary                          |
| 07      | Orders + Checkout       | [07-orders.md](07-orders.md)               | Phụ thuộc Cart, Reservation, idempotency và outbox               |
| 08      | Payments                | [08-payments.md](08-payments.md)           | Chỉ thanh toán cho Order đã được tạo đúng                        |
| 09      | Promotions              | [09-promotions.md](09-promotions.md)       | Cần Order financial snapshot ổn định                             |
| 10      | Fulfillment             | [10-fulfillment.md](10-fulfillment.md)     | Phụ thuộc Order và Payment lifecycle                             |
| 11      | Notifications           | [11-notifications.md](11-notifications.md) | Consume event ổn định từ các module phía trước                   |

OpenAPI sinh từ runtime là HTTP contract thực thi. Spec giải thích business semantics và không được đánh dấu hoàn tất nếu code, migration, tests và contract chưa cùng khớp.
