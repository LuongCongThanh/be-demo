---
status: reference
---

# Phạm vi MVP thương mại end-to-end (tài liệu umbrella)

**Vai trò của tài liệu:** Đây là tài liệu tham chiếu về phạm vi, thứ tự và quy tắc xuyên luồng; không phải nhiệm vụ triển khai và không sở hữu đầu ra nghiệm thu riêng. Các đặc tả nhiệm vụ 26–36 là nguồn có thẩm quyền cho tiêu chí nghiệm thu và trạng thái triển khai từng lát cắt.

## Problem Statement

Backend đã có nền tảng cho danh mục, sản phẩm, voucher, định danh và hạ tầng; tuy nhiên Người mua chưa thể hoàn thành toàn bộ hành trình mua sắm từ Giỏ hàng đến nhận hàng, huỷ hoặc Đổi trả theo nghiệp vụ Việt Nam. Staff và Admin cũng chưa có chuỗi thao tác thống nhất cho tồn kho, thanh toán, giao hàng, hoàn tiền, báo cáo và vận hành. Các khả năng còn tách rời hoặc chỉ nằm trong tài liệu, nên cần một kế hoạch implementation theo từng vertical slice có thứ tự phụ thuộc, tránh xây dựng trùng task 17 và task 24.

## Solution

Định hướng backend MVP cho cửa hàng thời trang B2C Việt Nam: Người mua có thể duyệt catalog, giữ Giỏ hàng, đăng nhập hoặc mua như Khách vãng lai, xác nhận Tính thử, đặt đơn COD hoặc online, theo dõi/huỷ đơn, tra cứu đơn và quản lý sổ địa chỉ. Staff xử lý xác nhận, đóng gói, bàn giao GHN, tồn kho, Đổi trả và ghi nhận Hoàn tiền. Admin quản lý cấu hình vận hành, nhân sự và báo cáo. Các chuyển trạng thái và side effect phải nhất quán với `GLOSSARY.md`, business rules và ADR; từng lát cắt triển khai được đặc tả ở nhiệm vụ 26–36.

Mục tiêu end-state là chuỗi module/backend có thể chạy thử end-to-end qua API: identity, customer, cart, inventory, ordering, payment, fulfillment, returns-refunds, notification và administration. Catalog/category và authorization nền là các điều kiện tiên quyết hoặc được tái sử dụng trực tiếp.

## User Stories

1. As a Guest, I want to keep an active Cart across sessions for 30 days, so that I do not lose products while browsing.
2. As a Guest or Customer, I want to add a Variant once and adjust quantity, so that my Cart reflects the exact size and color I want.
3. As a Buyer, I want Cart quantity limited to 10 per Variant, so that unusual quantities cannot be submitted.
4. As a Buyer, I want Cart operations to never reserve or decrement Stock, so that browsing does not block other buyers.
5. As a Customer, I want my Guest Cart merged into my account Cart after login, so that I keep every selected Variant without duplicates.
6. As a Buyer, I want to see the current EffectivePrice in my Cart and a change notice, so that I know if a price changed after adding it.
7. As a Buyer, I want to begin Checkout without an account, so that I can complete a purchase as a Guest.
8. As a Customer, I want Checkout to use my saved address or current address, so that I spend less time entering delivery details.
9. As a Guest or Customer, I want to enter a Vietnamese two-level province/ward address, so that the shipment is routable.
10. As a Buyer, I want Checkout to calculate ShippingFee from GHN, so that I know the delivery cost before placing an Order.
11. As a Buyer, I want a FallbackShippingFee when GHN is unavailable, so that Checkout can continue in degraded mode.
12. As a Buyer, I want one applicable Voucher validated and explained clearly, so that I know why it may or may not apply.
13. As a Buyer, I want applying a second Voucher to replace the first, so that the Cart always has at most one promotion.
14. As a Buyer, I want FreeShippingThreshold applied after Voucher discount, so that shipping is calculated according to the business rules.
15. As a Buyer, I want a Quote before placing an Order, so that I can confirm the exact lines, prices, Voucher, shipping and total.
16. As a Buyer, I want any changed Quote detail to invalidate the old confirmation, so that I never pay based on stale or silently adjusted data.
17. As a Buyer, I want Checkout to require an Idempotency-Key, so that retries do not create duplicate Orders or Voucher usages.
18. As a Buyer, I want COD only when OrderTotal is within CodLimit, so that large purchases use online payment.
19. As a Buyer placing a COD Order, I want the Stock decremented and the Order placed immediately, so that the purchase is committed without online payment.
20. As a Buyer choosing COD, I want to receive the public OrderCode and confirmation details, so that I can identify and track the Order.
21. As a Buyer choosing online payment, I want a Payment link for VNPay or MoMo, so that I can pay through my preferred gateway.
22. As a Buyer choosing online payment, I want the Order to remain PENDING_PAYMENT until gateway confirmation, so that I do not receive a false confirmation.
23. As a Buyer, I want the payment link to expire after 10 minutes, while Reservation lasts 15 minutes, so that checkout windows follow the MVP timing rules.
24. As a Buyer, I want payment retries by the same or a different gateway until minute 7, so that transient payment failures remain recoverable.
25. As a Buyer, I want successful IPN or reconciliation to confirm my online Order, so that confirmation is independent of the browser return page.
26. As a Buyer, I want duplicated IPN notifications ignored safely, so that one captured payment is not processed twice.
27. As a Buyer, I want a mismatched payment amount flagged for Staff rather than silently accepted or cancelled, so that money and Orders remain traceable.
28. As a Buyer, I want unexpected payment for a cancelled or already-processed Order to create a Refund Request, so that excess or late money is not lost.
29. As a concurrent Buyer, I want the last available Variant to go to only one successful Order, so that the store never sells beyond AvailableQuantity.
30. As a concurrent Buyer, I want checkout retries and competing Requests handled atomically, so that one request can succeed without creating partial stock or payment records.
31. As a Guest, I want to view and cancel a just-created Order for 30 minutes without lookup, so that a mistaken order can be corrected immediately.
32. As a Guest, I want to look up an existing Order by OrderCode and phone, so that I can track it without creating an account.
33. As a Guest, I want failed order lookups to return a non-disclosing response and be rate limited, so that Order and phone information remain protected.
34. As a Customer, I want to view my Order history and line snapshots, so that later catalogue or price changes do not alter my completed purchase record.
35. As a Buyer, I want to cancel only while the Order is before PACKING, so that irreversible fulfilment is not bypassed.
36. As a Buyer, I want online payment cancellation to explain that Refund follows, so that I know the money is not lost.
37. As a Buyer, I want cancellation to release stock, inventory allocation and eligible Voucher usage consistently, so that no side effect remains dangling.
38. As a Customer, I want to register with an email and 15-character-or-longer password, so that my account meets the MVP authentication threshold.
39. As a Customer, I want email verification and Google login to link eligible Guest Orders, so that verified identity can be associated without linking by phone.
40. As a Customer, I want login, registration and password reset responses to resist account enumeration, so that attackers cannot discover account existence.
41. As a Customer, I want temporary account lockout after repeated wrong passwords and IP throttling, so that brute-force attempts are reduced.
42. As a Customer, I want password reset links and successful password reset to invalidate stale sessions, so that lost-password recovery is secure.
43. As a Customer, I want to maintain an address book and choose Vietnamese or English interface and email language, so that my account fits my preferences.
44. As a Customer, I want to update my profile but not change email directly, so that identity remains stable in MVP.
45. As a Staff user, I want to list and filter Orders, including those with Flags, so that exceptions are handled in priority.
46. As a Staff user, I want to confirm an Order and move it into packing, so that fulfilment starts only after successful validation.
47. As a Staff user, I want to hand over a PACKING Order to GHN, so that a Shipment is created and awaiting transport.
48. As a Staff user, I want failed GHN Shipment creation retried through the existing Shipment, so that duplicate carrier deliveries are avoided.
49. As a Staff user, I want GHN webhooks and reconciliation to update shipment state without conflicting transitions, so that the Order remains consistent.
50. As a Staff user, I want reconciliation to use 15-minute polling with backoff for persistent failures, so that MVP delivery state remains recoverable without public SLA claims.
51. As a Staff user, I want to cancel a damaged or lost SHIPPING Order with a reason and stock disposition, so that lost, returned or reshipped goods are accounted for.
52. As a Staff user, I want to receive Flags for fallback shipping, payment mismatch, unexpected payment and shipment failure, so that exceptional Orders are visible.
53. As a Staff user, I want an audit trail for every back-office mutation, so that who changed what and when is provable.
54. As an InternalAccount, I want storefront purchase operations blocked even if my session reaches a public purchase API, so that Staff and Admin cannot act as Buyers.
55. As a Staff or Admin, I want to adjust Stock only with a reason and an atomic movement record, so that inventory corrections are explainable.
56. As a Staff or Admin, I want stock decrements capped by AvailableQuantity, so that adjustments cannot create negative or oversold stock.
57. As a Staff or Admin, I want to enter physical StockCount values and compare them with OnShelf, so that discrepancies are identified before confirmation.
58. As a Staff or Admin, I want inventory discrepancies recalculated at confirmation time, so that concurrent sales are not lost.
59. As a Staff or Admin, I want restocking after ReturnedToSender or accepted Return to create exactly one movement, so that duplicate confirmation cannot inflate Stock.
60. As a Staff or Admin, I want to record a manual Refund with gateway transaction and date, so that the financial obligation is closed only after evidence exists.
61. As a Staff or Admin, I want total refunds for a Payment to never exceed the captured amount, so that over-refunding is prevented.
62. As a Staff or Admin, I want an accepted Return to calculate refundable amounts by actual paid allocation, so that voucher and multi-return rounding remain correct.
63. As a Staff or Admin, I want to accept or reject each Return line and choose restock or defective handling, so that inventory and customer outcome are explicit.
64. As a Staff or Admin, I want a rejected Return to remain auditable and route rejected goods back to the Buyer at Buyer expense, so that the process is traceable.
65. As a Staff or Admin, I want a sale to become Completed only after 7 days and no open Return, so that Revenue is recognized at the correct time.
66. As an Admin, I want to manage Staff Accounts and RBAC permissions, so that operational access remains least-privilege.
67. As an Admin, I want to configure fallback ShippingFee, FreeShippingThreshold and CodLimit, so that operational policy can change without code deployment.
68. As an Admin, I want to maintain GHN ward mappings, so that Checkout can calculate and create shipments reliably.
69. As an Admin, I want revenue reports split into merchandise and shipping and based on Completed Orders, so that accounting receives accurate totals.
70. As an Admin, I want to export a daily payment list for accounting, so that manual e-invoice work is supported without a new internal accountant role.
71. As a Buyer, I want TransactionalEmail for relevant Order, payment, shipping and refund changes, so that I receive accurate updates without marketing noise.
72. As a Buyer, I want Email language and content to follow my saved or checkout-selected locale while Product names remain Vietnamese, so that notifications are understandable and stable.
73. As a Buyer, I want email-marketing consent stored separately from operational Consent, so that the company does not infer marketing permission from purchase consent.
74. As a Buyer or Guest, I want checkout registration to present unchecked, separate operational and marketing consent choices, so that consent evidence is explicit.
75. As a Buyer, I want consent evidence to include policy version, timestamp and channel, so that compliance audits can be supported.
76. As a Staff or Admin, I want personal-data views and searches recorded without logging routine list access, so that access auditing is proportional.
77. As an implementation agent, I want the public API and state changes to return stable domain errors, so that frontend, workers and retries do not guess behavior.

## Implementation Decisions

- Build MVP as ordered vertical slices through public API behavior: identity and storefront prerequisites; Cart; Quote and Checkout; inventory and Order state; payment; fulfillment; staff operations; refunds/returns; notifications; reporting/compliance. Catalog/category remains a prerequisite for slices that browse or purchase products.
- Customer identity stories 38–44 are prerequisites for authenticated Buyer flows. Task 26 consumes the authenticated Customer context for cart merge; Task 30 owns the acceptance for using that identity to access Order history and link eligible Guest Orders. Neither task should infer identity from a phone number.
- Complete task 17 before relying on the Admin/Staff permission matrix; retain task 24 as the catalog/locale contract for Category and Product. Task 11 and hosting rollout remain separate from feature implementation.
- Use the existing module boundaries as ownership seams: identity for authentication, customer for addresses, cart for browser/account baskets, inventory for reservations and stock, ordering for Order state and Quotes, payment for gateways, fulfillment for GHN, returns-refunds for returns and refunds, notification for email, and administration for settings, audit, compliance and reporting.
- Keep the existing one-warehouse constraint. AvailableQuantity, OnShelf and all inventory state remain PostgreSQL-owned; Redis is only cache, rate limit or queue, never the source of commercial truth.
- Make checkout a two-step Quote and confirmed placement flow. Quote is time-limited and not a reservation. Placement must atomically revalidate every line, EffectivePrice, discount, Voucher, ShippingFee and total against the confirmed Quote, reject stale confirmation and remain idempotent.
- Place all inventory reserve/decrement, Voucher usage, Order creation, payment records, status history and outbox events in one transaction where a use case spans modules. Preserve row-lock ordering and conditional updates to prevent overselling and lost updates.
- Represent online payment as one or more attempts in separate records from the Order and route VNPay/MoMo behind a shared gateway interface. Confirm payment only from IPN or reconciliation, deduplicate notifications and never confirm from browser return.
- Preserve the 15-minute Reservation and 10-minute payment-link window. Reconcile payments every 5 minutes and GHN shipments every 15 minutes unless existing specifications supersede those schedules.
- Preserve outbox delivery semantics, stable idempotency keys and domain event exchange. External email, GHN and gateway effects happen after database commit and are retried through idempotent workers.
- Treat Order state transitions as the central commercial state machine. Apply only valid transitions, serialize competing payment/expiration/job actions on the Order, and route unexpected money to explicit Refund Requests and Flags.
- Track AwaitingDispatch separately and remove it when Shipment succeeds. Cancellation before dispatch returns it to Stock; cancellation during delivery follows the documented loss/restock and refund branches.
- Record every Staff mutation and access-sensitive personal-data view according to the applicable audit requirements.
- Keep public and internal policies in configuration only where already specified. Do not add a second Warehouse, multi-currency, electronic-invoice integration, e-invoice providers, native mobile apps, SMS/Zalo notifications or marketing automation.
- Use the existing API conventions, module export boundaries, pagination, Swagger/OpenAPI, audit infrastructure, SMTP transport and error handling. No module may write another module's owned tables or bypass public module services.

## Testing Decisions

- The highest and preferred test seam is the public HTTP API for a complete Buyer or Staff scenario, with only external providers stubbed: this verifies observable behavior across the real modules while avoiding tests coupled to private helper structure.
- Good tests assert external outcomes: HTTP status and contract, resulting Order state, Stock and Reservation quantities, Voucher usage, email/outbox intent, payment state, shipment state, flags and audit evidence. They must not assert private method calls or internal class structure.
- Reuse existing Vitest unit, service and HTTP/e2e patterns in the repository. Payment gateway adapters, GHN, SMTP and translation services are fake or stubbed during tests; no test must call a real gateway or incur a fee.
- Prioritize one or a few end-to-end scenarios per critical vertical slice, then add focused boundary tests for races and idempotency. The preferred suite covers:
  - Complete COD checkout and buyer cancellation.
  - Online checkout, IPN confirmation, duplicate IPN and late payment.
  - Concurrent checkout of the last Variant and stale Quote mismatch.
  - Cart merge and Guest/Customer isolation.
  - Guest lookup rate limit and account enumeration resistance.
  - GHN webhook success, retry, 15-minute reconciliation and shipment failure.
  - Staff confirmation, packing, handover and delivery completion.
  - Refund, unexpected payment, cancellation and Return with restock/no-restock choices.
  - Stock adjustment, StockCount discrepancy and concurrent reconciliation.
  - Locale, consent evidence and audit access.
- Test the exact race boundaries rather than timing sleep: overlap Checkout and cancellation, IPN and expiration, Quote and price/stock changes, payment and shipment status callbacks, and retry/reconciliation duplicates.
- Each implementation slice must run the smallest relevant test command before integration. Before final completion, run Prisma generate, lint, typecheck, unit tests, targeted e2e tests and build; report explicitly if database-backed or external-gateway conditions prevent a check.

## Out of Scope

- Task 11 deployment and hosting rollout.
- A second Warehouse or support for multi-location inventory.
- Electronic-invoice provider integration; MVP remains manual accounting export plus the documented go-live checks.
- SMS, Zalo ZNS, push, OTP login and marketing automation.
- Wishlist and Product reviews.
- Flash sales and loyalty points.
- Automatic or API-driven Refund; refunds remain manual Staff records for MVP.
- Buyer-created online Returns; Staff still creates and processes them.
- International sales, multi-currency and tax-calculation engines.
- Native mobile applications.
- Multi-language Product content; only the Vietnamese and English storefront/admin/Category contract where already specified.
- Customer-facing exchange that does not reduce to accepted Return plus a new Order.
- Legal, accounting or go-live decisions not already fixed in repository business documents.
- Customer-data retention, erasure and anonymization policy; this umbrella specifies no lifecycle rules or retention durations.
- Cache invalidation and CMS/store rollout beyond the backend contract; task 24 integration remains separate from completing its backend contract.

## Further Notes

- The seams are deliberately one API-facing slice at a time. The single highest-value seam is the public HTTP scenario end-to-end; private module tests are subordinate and should be used only for race and calculation edges that cannot be proven through API behavior.
- Task 17's Admin permission and `create-admin` closure and task 24's category/locale contract remain prerequisites for dependent slices; tasks 26–36 own their completion status. Reuse task 23 Voucher and task 22 sale-price work rather than reimplementing them.
- This document is a non-authoritative umbrella reference, not a delivery coordinate or substitute for slice specs. The implementation tasks 26–36 own their acceptance criteria and delivery.
- The high-level sequence is identity/Customer prerequisites → catalog reuse → Cart → Quote/Checkout/Inventory/Ordering → payment and outbox → fulfillment → Staff operations → Refund/Return → notification/administration. Task dependencies in the plan table are authoritative.
