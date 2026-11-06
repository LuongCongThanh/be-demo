---
status: todo
pr:
blocked-by: []
---

# Spec 01: Mô hình bốn vai trò (rename roles)

## Mục tiêu

Code dùng đúng vai trò `customer` / `staff` / `admin` theo [ADR 0005](../../../adr/0005-four-actor-authorization-model.md) và [02-actors-permissions](../../../business/02-actors-permissions.md); quyền ghi catalog chỉ cho `admin`.

## Hiện trạng (lệch)

- Role là **dữ liệu** trong bảng `roles` + `user_roles` (nhiều-nhiều), tên `CUSTOMER`, `ORDER_STAFF`, `STORE_MANAGER`, `MASTER_ADMIN` — GLOSSARY xếp các tên này vào "Tránh".
- JWT mang `roles: string[]`; `OwnershipGuard` bỏ qua kiểm tra cho `MASTER_ADMIN`.
- Catalog write cho phép `STORE_MANAGER` (tương đương Staff) — business chỉ cho Admin.
- `UserStatus` = `ACTIVE`/`BLOCKED`; cột `authorization_version` — docs gọi là `status active/disabled`, `session_version` ([11-database §4.1](../../../architecture/11-database.md)).

## Phạm vi

1. `users.role` enum `customer | staff | admin`, NN — mỗi Tài khoản **đúng một** vai trò. Bỏ bảng `roles`, `user_roles`.
2. `users.status` enum `active | disabled`; `authorization_version` → `session_version`.
3. JWT payload: `role: Role` (một giá trị), `sessionVersion`. Response login / `GET /auth/me` trả `role`.
4. `@Roles()` nhận kiểu enum `Role`, mỗi route khai báo tường minh.
5. Catalog write (categories, products, variants): `@Roles('admin')`.
6. `OwnershipGuard`: bypass cho `admin` (giữ hành vi cũ của `MASTER_ADMIN`).
7. Seed + test helper dùng role mới.

## Ngoài phạm vi

Staff management, CLI `create-admin`, audit log (task 02). Đổi đăng ký/đăng nhập ngoài việc trả `role`.

## Quy tắc tham chiếu

ADR 0005 · `business/02` §1, §3.2 · US-502 · `11-database` §4.1 · `convention/prisma-conventions.md` (migration SQL tay).

## Acceptance criteria

- AC1: Migration chạy trên DB dev có dữ liệu cũ: user `CUSTOMER` → `customer`, `STORE_MANAGER`/`ORDER_STAFF` → `staff`, `MASTER_ADMIN` → `admin`; không mất user. User có nhiều role → lấy role cao nhất (`admin` > `staff` > `customer`).
- AC2: `POST /categories`, `/products`, variant write: token `staff` → 403, `admin` → 2xx.
- AC3: Response login và `GET /auth/me` có `role: "customer"` (string, không phải mảng).
- AC4: Token phát trước migration (payload `roles[]`) → 401 (bị từ chối, buộc đăng nhập lại).
- AC5: `grep -rE "STORE_MANAGER|MASTER_ADMIN|ORDER_STAFF|BLOCKED|authorizationVersion" src test prisma/seed.ts` rỗng (trừ `src/generated` và migration cũ).
- AC6: `npm run lint`, `typecheck`, `test`, `test:e2e` xanh.
