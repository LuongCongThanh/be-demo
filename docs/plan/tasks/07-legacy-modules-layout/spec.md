---
status: todo
pr:
blocked-by: [06-catalog-module]
---

# Spec 07: Gộp `auth` + `staff` thành module identity

Branch: `chore/identity-module` · Nguồn: [architecture review 2026-11-06, đề xuất #2](../../../architecture/reviews/architecture-review-2026-11-06.html)

## Problem Statement

Task 06 chốt layout chung cho mọi module (`coding-style §2.2`): gốc chỉ có `<module>.module.ts`, controller nằm dưới `controllers/{storefront,back-office}/`. `auth/` và `staff/` vẫn nằm phẳng dưới `src/`, nên repo đang có hai kiểu bố cục.

Tài khoản nội bộ là khái niệm của `identity` (02-modules), nhưng `InternalAccountService` nằm trong `auth/services/`, còn phần quản lý Staff lại ở `staff/`. Cả `staff/` lẫn `cli/` đều gọi thẳng vào bên trong `auth/`. Ranh giới giữa `auth` và `staff` không thật: bỏ nó đi cũng không làm code phức tạp thêm (không qua deletion test).

## Solution

Tạo một `IdentityModule` ở `src/modules/identity/`, theo đúng khuôn catalog. Thay đổi này **thuần di chuyển**: không đổi logic, route, Swagger tag hay response. Guard và decorator phân quyền dùng chung **giữ nguyên ở `src/auth/`** để đề xuất #3 (`@Authorize`) chuyển sau. Như vậy mỗi file chỉ phải di chuyển một lần.

## User Stories

1. As a developer working on Tài khoản, I want registration, sessions, password reset, profile and Staff management in one module, so that every lifecycle rule (E5, US-1001, ADR 0005) is in one place.
2. As a developer reading `staff`, I want `InternalAccountService` next to `StaffService`, so that I don't reach into another module's internals.
3. As a CLI maintainer, I want `create-admin` to depend on `IdentityModule`'s exported `InternalAccountService`, so that the CLI uses the module interface, not a file path inside `auth/`.
4. As a developer starting the next module, I want `auth`/`staff` to follow the same layout as catalog, so that the repo has one layout.
5. As a reviewer, I want this PR to be a pure move with unchanged tests and API, so that I can approve it without re-reviewing business logic.
6. As a FE developer, I want routes, Swagger and responses unchanged, so that nothing breaks on my side.
7. As the developer doing #3 later, I want the shared guards/decorators untouched, so that #3 moves them exactly once.

## Implementation Decisions

1. Một Nest module `IdentityModule` thay cho `AuthModule` và `StaffModule`.
2. Layout giống catalog: `controllers/storefront/` (auth, me), `controllers/back-office/` (`staff.controller` đổi tên thành `admin-staff.controller`, class `AdminStaffController`), `services/<nhóm>/`, `dto/<nhóm>/`, `strategies/`, `guards/` (chỉ guard riêng của identity).
3. Service giữ nguyên cách chia hiện có. `auth.service.ts` **chưa tách** (để task 08). `services/internal-account/` chứa cả `InternalAccountService` và `StaffService`, hai service riêng, không gộp.
4. `IdentityModule` chỉ export `PassportModule` và `InternalAccountService`.
5. **Giữ ở `src/auth/`** (để #3 xử lý): `jwt-auth.guard`, `roles.guard`, `ownership.guard`, `roles.decorator`, `current-user.decorator`, `owned-resource.decorator`, `is-strong-password.decorator`.
6. **Chuyển vào identity**: `email-throttler.guard` (chỉ auth controller dùng) và `jwt.strategy`.
7. Catalog và CLI đổi `imports: [AuthModule]` thành `imports: [IdentityModule]`, không đổi gì khác.
8. Không thêm mục "identity" vào `GLOSSARY.md`; đây là tên module, không phải khái niệm nghiệp vụ.

## Testing Decisions

- Không thêm hay sửa assertion. Unit spec di chuyển cùng file nguồn. E2E chỉ đổi đường dẫn import (`email-throttler.guard`, `password.service`, `token.service`, `auth.service`).
- Bằng chứng không đổi hành vi: số file test và số test trước bằng sau; Swagger JSON đã sắp xếp khoá trước bằng sau.

## Acceptance Criteria

- [ ] AC1: `src/staff/` không còn tồn tại. `src/auth/` chỉ còn các file ở Quyết định 5 và spec của chúng.
- [ ] AC2: `app.module.ts` import `IdentityModule` và không còn `AuthModule`/`StaffModule`. `IdentityModule` chỉ export `PassportModule` và `InternalAccountService`.
- [ ] AC3: `grep -rnE "#src/(staff/|auth/(services|dto|strategies|auth\.|me\.|guards/email))" src test --include=*.ts` cho kết quả rỗng, kể cả chuỗi trong `vi.mock`.
- [ ] AC4: `npm run lint`, `typecheck`, `test`, `test:e2e` xanh và **không sửa assertion nào**. Số file test và số test bằng trước.
- [ ] AC5: diff giữa `jq -S` của Swagger trước và sau là rỗng.
- [ ] AC6: mục "Hiện tại" trong `02-modules §4` được cập nhật, có `modules/identity/` và không còn `auth/ staff/`.

## Out of scope

Tách `auth.service.ts` theo use case (task 08), `@Authorize` và việc chuyển guard (#3), `infrastructure/` cho `mail`/`audit` (#4).
