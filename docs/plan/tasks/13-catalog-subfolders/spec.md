---
status: todo
pr:
blocked-by: []
labels: [ready-for-agent]
---

# Spec 13: `catalog/` theo layout phẳng — `product/` `category/` `product-option/`

Branch dự kiến: `refactor/catalog-subfolders` · Slice 0 của tái cấu trúc ba repo (spec cha nằm ở workspace, ngoài repo).

## Problem Statement

`modules/catalog/` vẫn chia theo vai trò file (`controllers/ services/ dto/ mappers/ domain/ constants/ decorators/`), trái với layout đã chốt ở `docs/architecture/02-modules.md` và `coding-style-conventions.md §2` (#73). Hai file hạ tầng còn sai chỗ: `bootstrap/setup-swagger.ts` và `common/utils/prisma-error.util.ts`.

## Solution

Thuần di chuyển + đổi tên file, không đổi hành vi:

- `catalog/product/`: `product.controller.ts` (← storefront `products.controller.ts`), `admin-product.controller.ts`, `product.service.ts`, `admin-product.service.ts`, `admin-product-image.service.ts`, `variant-response.mapper.ts`, `product.constants.ts` (gộp `product.constants.ts` + `variant-include.constant.ts`), `dto/` (← `dto/products/*`).
- `catalog/category/`: `category.controller.ts`, `admin-category.controller.ts`, `category.service.ts`, `admin-category.service.ts`, `category-tree.ts` (← `domain/`), `dto/` (← `dto/categories/*`).
- `catalog/product-option/`: `product-option.controller.ts`, `admin-product-option.controller.ts`, `product-option.service.ts`, `option-code.decorator.ts`, `dto/` (← `dto/product-options/*`).
- `bootstrap/setup-swagger.ts` (+ spec) → `bootstrap/openapi.ts`; `common/utils/prisma-error.util.ts` → `infrastructure/database/prisma-error.util.ts`.
- Tên class đổi theo tên file số ít khi file đổi tên (vd. `ProductsService` → `ProductService`); `catalog.module.ts` giữ ở gốc, `exports` không đổi.
- Xoá thư mục cũ rỗng. `catalog/pricing/` **không** thuộc task này (slice B).

## Acceptance criteria

- Route, Swagger và response không đổi: diff `jq -S` của Swagger trước/sau rỗng (như task 06).
- `typecheck`, `lint`, `build` pass. Test cũ chỉ được sửa đường dẫn import / tên class, không sửa assertion; không viết test mới.
- Không còn import tới đường dẫn cũ.
