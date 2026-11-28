# Chia việc triển khai thành task

Type: grilling
Status: resolved

## Question

Chia toàn bộ việc triển khai thành các task trong `docs/plan/tasks/`: danh sách task, thứ tự, phụ thuộc, ranh giới PR (mỗi PR giữ nguyên hành vi, Swagger diff rỗng khi chỉ refactor), và tiêu chí nghiệm thu của từng task. Bao gồm cả các vi phạm đã biết: `pricing/domain/active-sale-prices.ts` nhận `PrismaService`; `catalog/product/domain/product-search.query.ts` dựng SQL nhưng nằm trong `domain/`; `identity/internal-account/services/admin/internal-account.service.spec.ts` nằm lệch khỏi service nó kiểm thử (`identity/internal-account.service.ts`); `category-language-race.spec.ts` là integration test đặt trong `application/`; doc cập nhật theo ticket 01; và phần Identity trong Not yet specified nếu đã rõ. Tiêu chí nghiệm thu của mỗi task phải gồm điều kiện cập nhật tài liệu cây thư mục/đường dẫn trong cùng PR (xem Notes của map), kèm danh sách tài liệu cụ thể mà task đó đụng tới. Các file code vượt giới hạn 200 dòng tại thời điểm 2026-11-24 phải được tách: `checkout/services/storefront/checkout.service.ts` (537), `identity/access.service.ts` (367), `identity/auth/services/storefront/session.service.ts` (304), `catalog/category/infrastructure/persistence/relational/adapters/prisma-category.repository.ts` (275), `.../prisma-category-translation.persistence.ts` (261), `catalog/product/services/admin/admin-product.service.ts` (245), `cart/cart.service.ts` (239), `voucher/services/admin/admin-voucher.service.ts` (219), `catalog/product/controllers/admin/admin-product.controller.ts` (216), `identity/auth/controllers/storefront/auth.controller.ts` (215), `catalog/category/admin/application/category/admin-category.service.ts` (214), `identity/internal-account.service.ts` (211), `identity/auth/services/storefront/registration.service.ts` (202) (số dòng thô; đếm lại theo luật `max-lines` khi làm task). Mỗi task refactor một module phải thêm module đó vào mục "Migrated modules" của `.claude/rules/module-architecture.md` và danh sách module của script lint; task viết tài liệu chuẩn phải đổi dẫn chiếu của rule này sang `docs/conventions/`, và gỡ các câu chuyển tiếp trong `coding-style.md`, `error-logging.md`, `api-conventions.md`, `prisma-schema.md` khi mọi module đã chuyển đổi.

## Answer

Chốt qua grilling ngày 2026-11-24. Người dùng yêu cầu spec viết chi tiết để Claude Code, Codex và Copilot đều làm đúng ý.

**12 task, mỗi task một PR, giữ nguyên hành vi** (spec đầy đủ trong `docs/plan/tasks/`; `plan.md`/`guide.md` viết khi bắt đầu từng task sau khi đối chiếu code):

| #   | Task                                                                                                                                      | Phụ thuộc  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 38  | [Viết tài liệu chuẩn kiến trúc module](../../../tasks/done/38-architecture-standard-docs/spec.md)                                         | —          |
| 39  | [Nền móng dùng chung cho kiến trúc mới](../../../tasks/done/39-shared-architecture-foundations/spec.md)                                   | 38         |
| 40  | [Script sinh luật lint ranh giới](../../../tasks/done/40-lint-boundary-generator/spec.md)                                                 | 39         |
| 41  | [Chuyển module inventory](../../../tasks/done/41-migrate-inventory/spec.md)                                                               | 40         |
| 42  | [Chuyển module voucher](../../../tasks/done/42-migrate-voucher/spec.md)                                                                   | 40         |
| 43  | [Chuyển catalog/category](../../../tasks/todo/43-migrate-catalog-category/spec.md)                                                        | 40         |
| 44  | [Chuyển catalog/product, product-option, pricing + CatalogService](../../../tasks/todo/44-migrate-catalog-product-option-pricing/spec.md) | 41, 43     |
| 45  | [Chuyển module cart](../../../tasks/todo/45-migrate-cart/spec.md)                                                                         | 41, 44     |
| 46  | [Chuyển module checkout](../../../tasks/todo/46-migrate-checkout/spec.md)                                                                 | 41, 42, 44 |
| 47  | [Chuyển identity/access + internal-account](../../../tasks/todo/47-migrate-identity-access-internal-account/spec.md)                      | 40         |
| 48  | [Chuyển identity/auth](../../../tasks/todo/48-migrate-identity-auth/spec.md)                                                              | 47         |
| 49  | [Hoàn tất chuyển đổi kiến trúc](../../../tasks/todo/49-finalize-architecture-migration/spec.md)                                           | 45, 46, 48 |

- **Test:** E2E giữ nguyên và phải xanh; unit test hỏng vì bỏ `PrismaService` được sửa tối thiểu sang repository giả; không viết test mới, không skip/xoá test (riêng task 39 có test nhỏ cho hạ tầng mới).
- **Thứ tự với task tính năng:** refactor trước; task 29 chờ 46, task 33 chờ 41.
- **Tiêu chí nghiệm thu chung** mỗi task chuyển module: build/typecheck/lint/test/test:e2e đạt; Swagger diff rỗng (`npm run openapi:write` + `git diff --exit-code docs/openapi/openapi.json`); chỉ `infrastructure/` dùng Prisma/`nestjs-cls`; thêm module vào danh sách lint và mục Migrated modules của rule agent; cập nhật tài liệu cây/đường dẫn trong cùng PR; `report.md` ghi khác biệt và bug thấy nhưng không sửa.
- Mọi vi phạm đã biết và 13 file vượt 200 dòng được giao vào đúng task.
