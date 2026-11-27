---
status: todo
pr:
blocked-by:
  - 41-migrate-inventory
  - 42-migrate-voucher
  - 44-migrate-catalog-product-option-pricing
---

# Chuyển module checkout sang kiến trúc chung

**Blocked by:** 41-migrate-inventory, 42-migrate-voucher, 44-migrate-catalog-product-option-pricing

**Status:** ready-for-agent

**What to build:** Chuyển module checkout sang kiến trúc chung: đưa module về bộ khung chung theo ADR 0015, giữ nguyên hành vi.

**Quyết định nguồn:** [Bản đồ chuyển đổi cho từng module](../../wayfinding/src-wide-architecture-standard/issues/02-layered-structure-criteria.md), [Chiến lược xử lý lỗi toàn src](../../wayfinding/src-wide-architecture-standard/issues/03-error-handling-strategy.md), [Hợp đồng transaction trong và giữa các module](../../wayfinding/src-wide-architecture-standard/issues/05-transaction-contract.md), [Ownership dữ liệu cho cart và checkout](../../wayfinding/src-wide-architecture-standard/issues/06-cart-checkout-ownership.md), [Cách tách checkout](../../wayfinding/src-wide-architecture-standard/issues/07-checkout-structure.md)

**Hình đích minh họa:** [cây toàn `src/modules`](../../wayfinding/src-wide-architecture-standard/assets/02-src-modules-target-tree.md). Đây là minh họa; tên file chính xác chốt theo code lúc làm.

## Đọc trước khi làm (bắt buộc với mọi agent: Claude Code, Codex, Copilot)

1. Rule kiến trúc: [`.claude/rules/module-architecture.md`](../../../../.claude/rules/module-architecture.md) và quyết định [ADR 0015](../../../adr/0015-one-layered-architecture-for-every-module.md).
2. Map quyết định: [Chuẩn kiến trúc thống nhất cho toàn `src/modules`](../../wayfinding/src-wide-architecture-standard/map.md) và các ticket được link trong spec này. Ticket là nguồn quyết định; spec này không được mâu thuẫn với ticket.
3. **Đối chiếu code hiện tại trước khi sửa.** Nếu code khác với mô tả trong spec (file đã đổi tên, đã có người làm một phần...), dừng lại và hỏi người dùng, không tự suy diễn.
4. Quy trình Git của repo: branch từ `dev`, Conventional Commit, PR vào `dev`, squash merge. **Không** ghi attribution AI/agent trong commit hay PR.

## Ràng buộc chung (refactor thuần, không đổi hành vi)

- **Không đổi** route, HTTP method, status code, response shape, message lỗi, Swagger. Không đổi schema Prisma hay migration.
- Không trộn sửa bug hay tính năng mới vào PR này. Thấy bug thì ghi vào `report.md`, không sửa.
- Mỗi file ≤ 200 dòng (không tính dòng trống, comment), mục tiêu ~150. Vượt thì tách theo trách nhiệm.
- Không tạo thư mục rỗng; không tạo interface/port/mapper khi không có nhu cầu thật.
- Không dùng barrel `index.ts`; import bằng alias `#src/...js`, không import tương đối.
- Test: E2E giữ nguyên và phải xanh. Unit test hỏng vì service không còn dùng `PrismaService` thì **sửa tối thiểu**: thay mock Prisma bằng repository giả (object cài đặt abstract class port). Không viết test mới (test phase làm sau), không xoá/skip test.

## Việc cần làm

1. Tách `checkout.service.ts` (537 dòng) theo [Cách tách checkout]:
   - `domain/checkout-pricing.ts` (giữ) + hàm thuần chuyển từ service: tính tổng, `buildOrderItems` (chia giảm giá theo dòng), `newOrderNumber`, `normalizeInput`, fingerprint. `domain/checkout.model.ts` (CheckoutQuote, Order, CheckoutLine).
   - `application/checkout-calculator.service.ts`: thay `calculateCheckout`/`findVoucher`; lấy dữ liệu từ `CatalogService`, `InventoryService`, `VoucherService` rồi gọi hàm thuần. Nhận tham số chỉ bước (Tính thử hay đặt đơn) để **giữ đúng loại lỗi hiện tại**: Tính thử trả 400/404, đặt đơn trả 409 cho cùng tình huống, message giữ nguyên.
   - `application/checkout-quote.service.ts`: Tính thử.
   - `application/place-cod-order.service.ts`: đặt đơn COD trong `TransactionRunner.run()`.
   - Port `checkout-quote.repository.ts` (quote, khoá dòng quote `FOR UPDATE`), `order.repository.ts` (tạo order + order items, tìm theo `quoteId`); adapter tương ứng.
   - `storefront/controllers/`, `storefront/dto/`, `storefront/mappers/checkout-response.mapper.ts` (`toQuoteResponse`, `toOrderResponse`), `storefront/guards/optional-customer-auth.guard.ts` (từ `security/`).
2. **Không còn đụng bảng module khác:** trừ tồn + tạo hàng chờ xuất qua `InventoryService.commitStockForOrder`; kiểm voucher qua `VoucherService.evaluate`; ghi nhận voucher qua `VoucherService.recordUsage`; variant/giá qua `CatalogService.getPurchasableVariants`.
3. **Thứ tự khoá giữ nguyên** trong giao dịch đặt đơn: quote → variant (`lockForUpdate`) → tồn kho (`lockForUpdate`) → voucher (`lockForUpdate`), mỗi loại theo id tăng dần.
4. **Idempotency** dùng port `IdempotencyStore` (task 39): `find` trước giao dịch; `start` đầu giao dịch (trả `boolean`: `false` = khoá đã có, không ném P2002 nên giao dịch còn dùng được; khi đó `find` để replay hoặc 409); `complete(…, 201, response)` cuối giao dịch; xử lý trùng khoá unique và replay y hệt hiện tại (khác body → 409 `Idempotency-Key was already used with a different request body`; đang xử lý → 409; quote đã dùng → 409 `Checkout quote has already been used`).
5. So khớp Tính thử theo ADR-0013 giữ nguyên (fingerprint khác → 409 `Price, stock, voucher, or shipping changed; request a new quote`).
6. Đổi exception trong domain/application sang lỗi chung; guard vẫn dùng exception NestJS.
7. Cập nhật `docs/architecture/modules/ordering.md` nếu mô tả checkout.

## Tiêu chí nghiệm thu chung

- [ ] `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` đều đạt.
- [ ] Swagger không đổi: `npm run openapi:write` rồi `git diff --exit-code docs/openapi/openapi.json` không có khác biệt.
- [ ] Trong `src/modules/checkout/`: chỉ file trong `infrastructure/` import `PrismaService`, `#src/generated/**` hay `@nestjs-cls/**`. Kiểm bằng `grep -rnE "PrismaService|#src/generated|@nestjs-cls" <thư mục module> | grep -v /infrastructure/` → rỗng.
- [ ] `domain/` và `application/` không import HTTP exception của `@nestjs/common`; chỉ ném lỗi từ `src/common/errors/`.
- [ ] Module được thêm vào danh sách module đã chuyển đổi của `scripts/generate-oxlint-boundaries.ts` (chạy lại script, `oxlint.json` cập nhật) và vào mục **Migrated modules** của `.claude/rules/module-architecture.md` (`checkout`); chạy `npm run agents:check` đạt.
- [ ] Tài liệu mô tả cây/đường dẫn được cập nhật trong cùng PR (`docs/architecture/02-modules.md` §4, `docs/architecture/modules/*.md` liên quan, `src/**/README.md`); `grep` các đường dẫn cũ trong `docs/` và `src/**/README.md` → rỗng.
- [ ] File vừa tách khỏi danh sách tạm `max-lines` (nếu có) được xoá khỏi danh sách đó.
- [ ] `report.md` ghi: số file trước/sau, các khác biệt so với spec, bug phát hiện nhưng không sửa.
