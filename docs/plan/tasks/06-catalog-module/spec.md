---
status: in-progress
pr:
blocked-by: []
---

# Spec 06: Gộp catalog thành một module

Branch: `chore/catalog-module` · Nguồn: [architecture review 2026-11-06, đề xuất #1](../../../architecture/reviews/architecture-review-2026-11-06.html)

## Problem Statement

[02-modules](../../../architecture/02-modules.md) định nghĩa một module `catalog` sở hữu categories, products, sizes, colors, product_variants, product_images. Code đang tách thành 3 Nest module nông (`src/categories/`, `src/products/`, `src/product-options/`), mỗi cái tự import `AuthModule` và tự khai controller storefront + admin. Hiểu một Sản phẩm được bán thế nào phải nhảy qua 3 folder; `cart`/`pricing`/`inventory` sau này sẽ phải phụ thuộc 3 chỗ.

## Solution

Một `CatalogModule` duy nhất ở `src/modules/catalog/` — module đầu tiên dưới `src/modules/`. Bố cục theo 02-modules §4 và coding-style §2: gốc chỉ có `catalog.module.ts`; `storefront/`, `back-office/`, `services/<entity>/`, `dto/<entity>/`, `domain/`, `mappers/`, `constants/`, `decorators/`. **Thuần di chuyển**: không đổi logic, route, Swagger tag, response.

## User Stories

1. As a developer working on catalog, I want every Danh mục / Sản phẩm / Biến thể / Size / Màu file in one module, so that I don't bounce between 3 folders to understand one rule.
2. As a developer starting `cart`/`pricing`/`inventory`, I want one `CatalogModule` to depend on, so that the dependency graph in 02-modules §3 matches the code.
3. As a reviewer, I want this PR to be a pure move with unchanged tests and API, so that I can approve it without re-reviewing business logic.
4. As a FE developer, I want routes and responses unchanged, so that nothing breaks on my side.

## Implementation Decisions

1. Một Nest module `CatalogModule`, thay 3 module cũ.
2. PR chỉ đụng catalog (+ docs liên quan); `auth`, `staff`, hạ tầng giữ nguyên chỗ.
3. Controller storefront → `storefront/`, controller `admin/*` → `back-office/`; service và DTO chia theo thực thể (`categories/`, `products/`, `product-options/`) trong `services/`, `dto/`; gốc chỉ có `catalog.module.ts`. Đồng thời gom file rời trong `common/` vào `middleware/`, `logging/`, `utils/`.
4. Giữ nguyên cách chia service; không gộp/tách logic, không đổi tên file.
5. `CatalogModule` không `exports` gì — `CatalogReader` thiết kế khi làm `cart`/`pricing` (YAGNI).
6. Làm trước đề xuất #3; tạm vẫn `imports: [AuthModule]`.
7. Không tạo `events/` (catalog chưa phát event) và không tạo `catalog.service.ts` chung (giữ service hiện có).
8. Thứ tự path trong Swagger được phép đổi (`StaffModule` hiện nằm giữa Products và ProductOptions); nội dung phải giống hệt.

## Testing Decisions

- Không thêm/sửa test. Unit spec di chuyển cùng file nguồn; e2e ở `test/` giữ nguyên (chỉ gọi URL qua `AppModule`).
- Bằng chứng không đổi hành vi: số file test + số test trước = sau, Swagger JSON đã sắp xếp khoá trước = sau.

## Acceptance Criteria

- [ ] AC1: `src/categories/`, `src/products/`, `src/product-options/` không còn tồn tại.
- [ ] AC2: `app.module.ts` chỉ import `CatalogModule` cho phần catalog; `CatalogModule` không có `exports`.
- [ ] AC3: `grep -rnE "(categories|products|product-options)/" src test --include=*.ts | grep -v "src/modules/catalog\|src/generated"` không còn tham chiếu đường dẫn cũ (bao gồm chuỗi trong `vi.mock`).
- [ ] AC4: `npm run lint`, `typecheck`, `test`, `test:e2e` xanh **không sửa assertion nào**; số file test và số test bằng trước.
- [ ] AC5: `jq -S . swagger-before.json` và `jq -S . swagger-after.json` (từ `/docs-json`) diff rỗng.
- [ ] AC6: 02-modules §4 mục "Hiện tại" cập nhật cả câu mô tả lẫn cây (có `modules/catalog/`, bỏ `categories/ products/`).

## Out of scope

Gộp identity (#2), decorator `@Authorize` (#3), `infrastructure/` (#4), tách service theo use case, đổi tên `product-options` theo GLOSSARY, `CatalogReader`.
