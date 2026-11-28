---
status: todo
pr:
blocked-by:
  - 41-migrate-inventory
  - 43-migrate-catalog-category
---

# Chuyển catalog/product, product-option, pricing và tạo CatalogService

**Blocked by:** 41-migrate-inventory, 43-migrate-catalog-category

**What to build:** Chuyển catalog/product, product-option, pricing và tạo CatalogService: đưa module về bộ khung chung theo ADR 0015, giữ nguyên hành vi.

**Quyết định nguồn:** [Bản đồ chuyển đổi cho từng module](../../../wayfinding/src-wide-architecture-standard/issues/02-layered-structure-criteria.md), [Chiến lược xử lý lỗi toàn src](../../../wayfinding/src-wide-architecture-standard/issues/03-error-handling-strategy.md), [Hợp đồng transaction trong và giữa các module](../../../wayfinding/src-wide-architecture-standard/issues/05-transaction-contract.md), [Ownership dữ liệu cho cart và checkout](../../../wayfinding/src-wide-architecture-standard/issues/06-cart-checkout-ownership.md)

**Hình đích minh họa:** [cây toàn `src/modules`](../../../wayfinding/src-wide-architecture-standard/assets/02-src-modules-target-tree.md), [cây `catalog`](../../../wayfinding/src-wide-architecture-standard/assets/02-catalog-target-tree.md). Đây là minh họa; tên file chính xác chốt theo code lúc làm.

## Đọc trước khi làm (bắt buộc với mọi agent: Claude Code, Codex, Copilot)

1. Rule kiến trúc: [`.claude/rules/module-architecture.md`](../../../../../.claude/rules/module-architecture.md) và quyết định [ADR 0015](../../../../adr/0015-one-layered-architecture-for-every-module.md).
2. Map quyết định: [Chuẩn kiến trúc thống nhất cho toàn `src/modules`](../../../wayfinding/src-wide-architecture-standard/map.md) và các ticket được link trong spec này. Ticket là nguồn quyết định; spec này không được mâu thuẫn với ticket.
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

1. **product:** `domain/product.model.ts` (type Product, ProductVariant, ProductImage) + giữ hằng số; port `application/ports/product.repository.ts`; adapter `infrastructure/prisma-product.repository.ts`; **chuyển `domain/product-search.query.ts` sang `infrastructure/`** (nó dựng SQL); service vào `application/` (`product.service.ts`, `admin-product.service.ts`, `admin-product-image.service.ts`); `dto/shared` + `mappers/shared` vào `presentation/`; controller và dto riêng vào `admin/`, `storefront/`. `admin-product-image.service.ts` dùng port Storage chung thay `CloudinaryClient`. Tách `admin-product.service.ts` (245) và `admin-product.controller.ts` (216) để ≤ 200.
2. **product đọc tồn kho:** thay việc `product.service.ts` đọc thẳng bảng `inventory` bằng `InventoryService.getAvailability()` (task 41). Response không đổi.
3. **product-option:** `domain/product-option.model.ts` (Color, Size), port `product-option.repository.ts` (color + size), adapter, service từ `services/shared` vào `application/`, `dto/shared/option-summary.dto.ts` vào `presentation/` (product được import theo quy tắc feature), `decorators/option-code.decorator.ts` vào `admin/`.
4. **pricing:** `domain/sale-price.model.ts`, giữ `sale-price-guards.ts`, `sale-price-status.ts`; port `sale-price.repository.ts`; **query trong `domain/active-sale-prices.ts` chuyển vào adapter** và xoá file đó khỏi `domain/`; service vào `application/`, controller/dto vào `admin/`.
5. **Class công khai** `catalog/application/catalog.service.ts` (`CatalogService`), provider duy nhất `CatalogModule` export cho nghiệp vụ:
   - `getPurchasableVariants(variantIds, options?: { lockForUpdate?: boolean })` → mỗi variant đang bán (variant `ACTIVE` và product `ACTIVE`): id, tên product, size, màu, cân nặng, giá gốc, giá khuyến mãi đang chạy (nếu có). Điều kiện y hệt `calculateCheckout` trong checkout. `lockForUpdate` khoá dòng `product_variants` theo id tăng dần.
   - Chưa đổi cart/checkout gọi hàm này.
6. Trong `catalog`, feature chỉ import `domain/`, `presentation/` của feature khác (ví dụ `isEffectivelyVisible` của category).
7. Đổi exception trong domain/application sang lỗi chung, giữ message. Thêm `catalog` (cả 4 feature) vào danh sách đã chuyển đổi khi xong.

## Tiêu chí nghiệm thu chung

- [ ] `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` đều đạt.
- [ ] Swagger không đổi: `npm run openapi:write` rồi `git diff --exit-code docs/openapi/openapi.json` không có khác biệt.
- [ ] Trong `src/modules/catalog/`: chỉ file trong `infrastructure/` import `PrismaService`, `#src/generated/**` hay `@nestjs-cls/**`. Kiểm bằng `grep -rnE "PrismaService|#src/generated|@nestjs-cls" <thư mục module> | grep -v /infrastructure/` → rỗng.
- [ ] `domain/` và `application/` không import HTTP exception của `@nestjs/common`; chỉ ném lỗi từ `src/common/errors/`.
- [ ] Module được thêm vào danh sách module đã chuyển đổi của `scripts/generate-oxlint-boundaries.ts` (chạy lại script, `oxlint.json` cập nhật) và vào mục **Migrated modules** của `.claude/rules/module-architecture.md` (`catalog`); chạy `npm run agents:check` đạt.
- [ ] Tài liệu mô tả cây/đường dẫn được cập nhật trong cùng PR (`docs/architecture/02-modules.md` §4, `docs/architecture/modules/*.md` liên quan, `src/**/README.md`); `grep` các đường dẫn cũ trong `docs/` và `src/**/README.md` → rỗng.
- [ ] File vừa tách khỏi danh sách tạm `max-lines` (nếu có) được xoá khỏi danh sách đó.
- [ ] `report.md` ghi: số file trước/sau, các khác biệt so với spec, bug phát hiện nhưng không sửa.
