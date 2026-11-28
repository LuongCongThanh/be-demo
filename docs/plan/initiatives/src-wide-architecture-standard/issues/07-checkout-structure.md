# Cách tách checkout

Type: grilling
Status: resolved

## Question

Checkout (`checkout.service.ts` 537 dòng: tính quote, idempotency replay, row lock bằng raw SQL, tạo đơn) tách theo trách nhiệm ra sao trong bộ khung chung (ADR 0015)? Quyết định: các service/use case sau khi tách, phần nào chuyển vào `domain/` (đã có `checkout-pricing`), có tạo Port nào không và vì sao, idempotency thuộc checkout hay hạ tầng dùng chung, và ranh giới với các public capability đã chốt ở ticket 06.

## Answer

Chốt qua grilling ngày 2026-11-24. Hành vi giữ nguyên: cùng route, mã lỗi và message (ví dụ Tính thử báo 400, đặt đơn báo 409 cho cùng tình huống như hiện tại), theo ADR-0013.

1. **Chia file theo việc** (mỗi file một việc, khoảng 50–150 dòng):
   ```text
   checkout/
   ├── domain/            checkout-pricing.ts (+ tính tổng, chia giảm giá theo dòng, sinh mã đơn: hàm thuần)
   │                      checkout.model.ts (type CheckoutQuote, Order, CheckoutLine)
   ├── application/
   │   ├── ports/         checkout-quote.repository.ts, order.repository.ts
   │   ├── checkout-calculator.service.ts   gọi Catalog/Inventory/Voucher rồi tính (dùng chung cho Tính thử và đặt đơn)
   │   ├── checkout-quote.service.ts        Tính thử
   │   └── place-cod-order.service.ts       đặt đơn COD trong transactionRunner.run()
   ├── infrastructure/    prisma-checkout-quote.repository.ts, prisma-order.repository.ts
   └── storefront/        controllers/, dto/, mappers/checkout-response.mapper.ts, guards/optional-customer-auth.guard.ts
   ```
2. **Idempotency là hạ tầng dùng chung:** port `IdempotencyStore` ở `src/infrastructure/idempotency/` (cùng kiểu Mail/Storage, theo ma trận sở hữu `idempotency_keys` thuộc hạ tầng). Checkout gọi `find`, rồi `start` và `complete` bên trong giao dịch; logic replay (cùng key khác body → 409, đang xử lý → 409) giữ nguyên. Thanh toán sau này dùng lại.
3. **Khóa dòng do module chủ thực hiện:** checkout yêu cầu qua tùy chọn `{ lockForUpdate: true }` trên `catalog.getPurchasableVariants`, `inventory.getAvailability`, `vouchers.evaluate`; khóa của `checkout_quotes` nằm trong adapter của checkout. Thứ tự giữ như hiện tại để tránh deadlock: quote → variant → tồn kho → voucher, mỗi loại sắp theo id. Khóa chỉ có tác dụng bên trong `transactionRunner.run()`.
