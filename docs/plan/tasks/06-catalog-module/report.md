# Report 06: Gộp catalog thành một module

Trạng thái: **done**, merged PR #63.

## Đã làm

- 3 module `categories/`, `products/`, `product-options/` → 1 `CatalogModule` ở `src/modules/catalog/` (`ad5cc32`).
- Controller gom dưới `controllers/{storefront,back-office}/`; convention `coding-style §2.2/§2.6` + `02-modules §4` cập nhật cho mọi module.
- Task follow-up: [07-identity-module](../07-identity-module/spec.md) cho `auth`/`staff`.

## Kết quả

AC1–AC7 đạt. Unit 233/233, e2e 175 (+1 skip sẵn có), Swagger `jq -S` diff rỗng (41 path). Chi tiết: [metric.md](./metric.md).

## Quyết định lệch kế hoạch

- Tách 2 hằng số ra `constants/` (không đổi giá trị): `SKU_PATTERN` (từ `create-variant.dto.ts` → `constants/product.constants.ts`) và `VARIANT_INCLUDE` (từ `variant-response.mapper.ts` → `constants/variant-include.constant.ts`) để khớp thư mục vai trò `constants/`. Lệch nhẹ khỏi "thuần di chuyển"; test + Swagger chứng minh không đổi hành vi.

- Plan ban đầu để controller ở `storefront/`, `back-office/` ngay gốc module; đổi sang `controllers/` sau review (2026-11-06) để cấp đầu module đồng đều kiểu NestJS. Không cần ADR (di chuyển file, dễ đảo ngược).
