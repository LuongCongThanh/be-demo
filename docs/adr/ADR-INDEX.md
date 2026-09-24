# Architecture Decision Records index

Mã `0001–0009` là mã lịch sử ổn định. ADR được nhóm theo thứ tự module spec để dễ tìm nhưng không đổi số khi roadmap thay đổi.

## 01 — Auth

| ADR                                        | Quyết định        | Decision | Implementation |
| ------------------------------------------ | ----------------- | -------- | -------------- |
| [0002](0002-uri-versioned-api-contract.md) | URI-versioned API | Accepted | Implemented    |

## 02 — Categories

| ADR                                      | Quyết định                  | Decision | Implementation |
| ---------------------------------------- | --------------------------- | -------- | -------------- |
| [0001](0001-category-delete-restrict.md) | Category delete bị restrict | Accepted | Implemented    |

## 03 — Products

| ADR                                                          | Quyết định                                   | Decision | Implementation |
| ------------------------------------------------------------ | -------------------------------------------- | -------- | -------------- |
| [0010](0010-pending-uploads-expire-via-storage-lifecycle.md) | Pending Upload ở `tmp/`, lifecycle tự xoá    | Accepted | Implemented    |
| [0011](0011-sku-composed-from-option-values.md)              | SKU ghép từ Product Code + Option Value      | Accepted | Implemented    |
| [0012](0012-product-patch-last-write-wins.md)                | PATCH Product last-write-wins, không version | Accepted | Implemented    |

## 04 — Users

| ADR                                                     | Quyết định         | Decision | Implementation |
| ------------------------------------------------------- | ------------------ | -------- | -------------- |
| [0005](0005-canonical-four-role-authorization-model.md) | Bốn Role canonical | Accepted | Partial        |

## 05 — Inventory và Outbox foundation

| ADR                                                             | Quyết định                            | Decision | Implementation |
| --------------------------------------------------------------- | ------------------------------------- | -------- | -------------- |
| [0003](0003-inventory-reservations-and-transactional-outbox.md) | Explicit Reservation và Outbox        | Accepted | Planned        |
| [0007](0007-outbox-done-means-downstream-ack.md)                | Outbox thành công sau acknowledgement | Accepted | Planned        |

## 06 — Cart

| ADR                                                   | Quyết định                    | Decision | Implementation |
| ----------------------------------------------------- | ----------------------------- | -------- | -------------- |
| [0009](0009-cart-row-lock-over-optimistic-version.md) | Shared Cart row-lock protocol | Accepted | Planned        |

## 07 — Orders

Chưa có ADR riêng; Checkout sử dụng ADR 0003, 0007 và 0009 từ các boundary liên quan.

## 08 — Payments

| ADR                                         | Quyết định                | Decision | Implementation |
| ------------------------------------------- | ------------------------- | -------- | -------------- |
| [0004](0004-momo-first-payment-provider.md) | MoMo-first provider       | Accepted | Planned        |
| [0006](0006-payment-refund-mvp-scope.md)    | Payment/refund MVP policy | Accepted | Planned        |

## 09–11 — Promotions, Fulfillment, Notifications

Chưa có ADR riêng. Chỉ tạo khi xuất hiện quyết định khó đảo ngược và có trade-off thực sự.

## Cross-cutting infrastructure

| ADR                                               | Quyết định                     | Decision | Implementation |
| ------------------------------------------------- | ------------------------------ | -------- | -------------- |
| [0008](0008-redis-outage-degrades-not-unready.md) | Redis outage không làm unready | Accepted | Partial        |

`Decision` nói quyết định đã được chốt hay chưa; `Implementation` nói code đã theo kịp quyết định tới đâu. Chỉ tạo ADR khi quyết định đồng thời khó đảo ngược, gây bất ngờ nếu thiếu bối cảnh và là kết quả của trade-off thực sự.
