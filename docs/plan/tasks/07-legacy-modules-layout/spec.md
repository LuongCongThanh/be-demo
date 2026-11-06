---
status: todo
pr:
blocked-by: [06-catalog-module]
---

# Spec 07: Đưa module cũ về layout `modules/<module>/controllers/`

## Problem Statement

Task 06 chốt layout chung cho mọi module (`coding-style §2.2`): gốc chỉ có `<module>.module.ts`, controller nằm dưới `controllers/{storefront,back-office}/`. `auth/`, `staff/` (và `mail/`, `audit/`) vẫn để phẳng dưới `src/`, nên repo đang có hai kiểu bố cục.

## Solution

Di chuyển từng module cũ vào `src/modules/<module>/` theo layout mới — thuần di chuyển, không đổi route/Swagger/response. `auth/` + `staff/` đi cùng đề xuất #2 (gộp identity → `modules/identity/`) để không di chuyển hai lần.

## Acceptance Criteria

- [ ] `auth/`, `staff/` → `modules/identity/` với `controllers/storefront/` + `controllers/back-office/`.
- [ ] `lint`, `typecheck`, `test`, `test:e2e` xanh không sửa assertion; Swagger `jq -S` diff rỗng.
- [ ] `02-modules §4` "Hiện tại" cập nhật.

## Out of scope

Đổi logic phân quyền (`@Authorize`, đề xuất #3); `infrastructure/` (#4).
