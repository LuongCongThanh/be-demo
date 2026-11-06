---
status: todo
pr:
blocked-by: []
---

# Spec 01: Mô hình bốn vai trò (rename roles)

Branch: `refactor/four-actor-roles` · Plan tổng: [PR 1](../../realign-identity-catalog.md)

## Problem Statement

Code identity được viết trước khi docs business được viết lại, nên mô hình vai trò lệch với [ADR 0005](../../../adr/0005-four-actor-authorization-model.md) và [business/02](../../../business/02-actors-permissions.md):

- Vai trò đang là **dữ liệu** (bảng `roles` + `user_roles`, nhiều-nhiều) với các tên `CUSTOMER`, `ORDER_STAFF`, `STORE_MANAGER`, `MASTER_ADMIN`. GLOSSARY xếp các tên này vào mục "Tránh".
- JWT mang `roles: string[]`, nên một Tài khoản có thể có nhiều vai trò. Business quy định mỗi Tài khoản có đúng một vai trò.
- `STORE_MANAGER` (tương đương Staff) được ghi catalog. Business chỉ cho Admin ghi.
- `UserStatus` = `ACTIVE/BLOCKED` và cột `authorization_version` không khớp tên trong [11-database §4.1](../../../architecture/11-database.md) (`active/disabled`, `session_version`).

Người làm task sau (cart, pricing…) và người đọc docs sẽ phải dịch qua lại giữa hai bộ từ vựng. Ngoài ra Staff đang có quyền mà business không cho.

## Solution

Mỗi Tài khoản có đúng một vai trò `customer | staff | admin`, lưu trong cột enum `users.role`. Một migration SQL viết tay chuyển dữ liệu cũ và giữ nguyên mọi user. Token và response trả `role` (một giá trị). Mọi route khai báo tường minh vai trò được phép, và ghi catalog chỉ dành cho `admin`. Token phát trước migration bị từ chối, buộc người dùng đăng nhập lại.

## User Stories

1. As an Admin, I want only my role to be able to create/update categories, products and variants, so that catalog changes follow business/02 §3.2.
2. As a Staff, I want to receive 403 when I call catalog write endpoints, so that I clearly know I lack the permission.
3. As a Customer, I want my login response to contain `role: "customer"`, so that the storefront FE can decide which channel I belong to.
4. As a FE developer, I want `role` to be a single string (not an array), so that channel checks are a simple equality.
5. As a FE developer, I want `GET /auth/me` to return the same `role` field as login, so that I can restore session state on reload.
6. As an operator, I want existing dev users migrated without data loss, so that I don't have to reseed accounts.
7. As an operator, I want users holding several old roles to end up with the highest one (`admin` > `staff` > `customer`), so that no one silently loses access.
8. As a security-minded operator, I want tokens issued before the migration (with `roles[]`) to be rejected with 401, so that stale permissions cannot survive the role change.
9. As an Admin, I want to keep bypassing ownership checks (former `MASTER_ADMIN` behaviour), so that I can still inspect any resource.
10. As a Customer, I want ownership checks to still apply to me, so that I cannot read other customers' data.
11. As a developer, I want `@Roles()` to accept only the `Role` enum, so that typos in role names fail at compile time.
12. As a developer, I want every route to list its allowed roles explicitly (no hierarchy inference), so that reading a controller tells me exactly who can call it (ADR 0005).
13. As a developer, I want user status named `active | disabled`, so that code matches 11-database and GLOSSARY.
14. As a developer, I want the session-invalidation counter named `session_version`, so that later task 02 (disable Staff) uses the documented name.
15. As a developer, I want seed data and test helpers to create users with the new roles, so that local setup and tests stay one-command.
16. As a reviewer, I want no old role names left in `src`, `test`, `prisma/seed.ts`, so that the vocabulary drift is verifiably gone.
17. As a disabled user, I want login to be refused, so that the renamed `disabled` status still blocks access like `BLOCKED` did.

## Implementation Decisions

- **Schema:** `users.role` enum `Role { customer, staff, admin }` NOT NULL, mỗi Tài khoản đúng một vai trò. Bỏ bảng `roles` và `user_roles`. Guest không có dòng trong DB.
- **Status:** `UserStatus { active, disabled }`. Đổi tên cột `authorization_version` → `session_version` (giữ giá trị).
- **Migration:** SQL viết tay theo `convention/prisma-conventions.md`. Map `CUSTOMER → customer`, `ORDER_STAFF`/`STORE_MANAGER → staff`, `MASTER_ADMIN → admin`. User có nhiều role → lấy role cao nhất. Backfill trước, sau đó mới đặt NOT NULL và drop bảng cũ.
- **JWT payload:** `{ sub, role: Role, sessionVersion }`. Strategy từ chối payload thiếu `role` hoặc có `roles` (token cũ) → 401.
- **API contract:** response login và `GET /auth/me` có `role: "customer" | "staff" | "admin"`. Ngoài trường này, contract đăng ký/đăng nhập không đổi.
- **Authorization:** `@Roles(...roles: Role[])` + `RolesGuard` so khớp chính xác, không suy cây phân cấp. Catalog write (categories, products, variants): `@Roles('admin')`. `OwnershipGuard` bypass cho `admin`.
- **Seed:** bootstrap admin (env `ADMIN_BOOTSTRAP_*`) được tạo với `role = admin`.

## Testing Decisions

- Test hành vi bên ngoài qua HTTP: request vào app thật (`createTestApp` + supertest, DB thật), assert status code và body. Không assert guard nội bộ hay chi tiết Prisma.
- Seam duy nhất: **e2e HTTP**. Cập nhật `auth-login`, `auth-me`, `categories`, `products` e2e (bỏ `prisma.role.upsert`, dùng `createTestUser` với `role`).
- Ca test mới: staff → 403 trên catalog write, admin → 2xx. `role` là string trong login và me. Token ký với payload `roles[]` → 401. User `disabled` không đăng nhập được.
- Migration kiểm tra thủ công trên DB dev có dữ liệu cũ (ghi kết quả vào `metric.md`). Không viết test tự động cho migration.
- Prior art: `test/products.e2e-spec.ts`, `test/categories.e2e-spec.ts`, `test/support/create-test-user.ts`.

## Out of Scope

Quản lý Staff, CLI `create-admin`, audit log (task 02). Google login (US-502). Hồ sơ khách hàng. Mọi thay đổi khác về đăng ký/đăng nhập ngoài việc trả `role`.

## Further Notes

Tham chiếu: ADR 0005 · `business/02` §1, §3.2 · `11-database` §4.1 · `convention/prisma-conventions.md`.

## Acceptance criteria

- AC1: Migration chạy trên DB dev có dữ liệu cũ, đúng mapping, không mất user. User nhiều role → role cao nhất.
- AC2: `POST /categories`, `/products`, variant write: token `staff` → 403, `admin` → 2xx.
- AC3: Login và `GET /auth/me` trả `role: "customer"` (string).
- AC4: Token phát trước migration (payload `roles[]`) → 401.
- AC5: `grep -rE "STORE_MANAGER|MASTER_ADMIN|ORDER_STAFF|BLOCKED|authorizationVersion" src test prisma/seed.ts` rỗng (trừ `src/generated` và migration cũ).
- AC6: `npm run lint`, `typecheck`, `test`, `test:e2e` xanh.
