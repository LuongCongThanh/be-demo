# Guide 01: Hướng dẫn tự viết code

> Gợi ý hướng làm và chỗ cần sửa — **không** phải code hoàn chỉnh. Tự viết, đối chiếu với [spec](./spec.md).

## 1. Schema Prisma

`prisma/schema/enums.prisma`:

- Thêm `enum Role { customer staff admin }` — giá trị lowercase khớp docs; không cần `@map`.
- `UserStatus` → `active`, `disabled`.

`prisma/schema/schema.prisma`, model `User`:

- Thêm `role Role` (không default — mỗi luồng tạo user phải chỉ rõ).
- `authorizationVersion` → `sessionVersion Int @default(0) @map("session_version")`.
- Xoá relation `userRoles`; xoá model `Role`, `UserRole`.

Câu hỏi tự kiểm: có nên `@default(customer)` không? (Gợi ý: không — tạo Staff/Admin mà quên truyền role sẽ âm thầm thành customer.)

## 2. Migration SQL

Prisma sinh SQL drop/create sẽ **mất dữ liệu**. Viết tay theo thứ tự:

1. `CREATE TYPE "Role" AS ENUM (...)`.
2. `ALTER TABLE users ADD COLUMN role "Role"` (nullable tạm).
3. `UPDATE users SET role = ...` từ `user_roles` join `roles` — dùng `CASE` + chọn role cao nhất khi user có nhiều role (AC1). Gợi ý: subquery với `max` theo thứ tự ưu tiên số.
4. User không có role nào → `customer`.
5. `ALTER COLUMN role SET NOT NULL`.
6. Đổi `UserStatus`: Postgres không xoá được giá trị enum → tạo type mới, `ALTER COLUMN status TYPE ... USING (CASE ...)`, drop type cũ, rename.
7. `ALTER TABLE users RENAME COLUMN authorization_version TO session_version`.
8. `DROP TABLE user_roles; DROP TABLE roles;`.

Sau đó `npx prisma migrate diff` (schema vs migrations) phải rỗng — nếu không, schema và SQL lệch nhau.

Xem `docs/convention/prisma-conventions.md` (migration SQL tay, safe schema change).

## 3. Auth

- `src/auth/strategies/jwt.strategy.ts`: `JwtPayload` → `role: Role`, `sessionVersion: number`. Import type `Role` từ `#src/generated/prisma/...` (xem cách file khác import enum generated). Bỏ comment "quyết định #6 — role là data" vì đã hết đúng.
- `validate()`: token cũ không có `sessionVersion`/`role` → `UnauthorizedException` (AC4). Nghĩ: `undefined !== user.sessionVersion` có tự bắt được không?
- `src/auth/services/auth.service.ts`:
  - `register`: bỏ lookup `tx.role.findUniqueOrThrow`, gán `role: 'customer'`, `status: 'active'`.
  - `signAccessToken` (~dòng 460): bỏ `userRoles.map`, trả `role`.
  - Mọi `include: { userRoles: { include: { role } } }` → bỏ.
  - Kiểu `user: {... roles: string[] }` (~dòng 45) → `role: Role`.
- DTO response login/me (`src/auth/dto/login-response.dto.ts`…): `@ApiProperty({ enum: Role })`.

## 4. Guards & decorator

- `roles.decorator.ts`: `(...roles: Role[])` — sai chính tả role giờ thành lỗi compile.
- `roles.guard.ts`: `requiredRoles.includes(user.role)`. Cập nhật comment.
- `ownership.guard.ts:23`: `user.role === 'admin'`.

## 5. Controllers

- `categories.controller.ts` (dòng ~42, 69, 82), `products.controller.ts` (~47, 74, 87, 101, 131, 146): `@Roles('admin')`.
- `src/common/swagger/api-tags.ts`: kiểm tên role trong mô tả.

## 6. Seed & test support

- `prisma/seed.ts`: bỏ upsert role; admin bootstrap tạo user `role: 'admin'`. (Task 02 sẽ thay bằng CLI.)
- `test/support/create-test-user.ts`: option `role?: Role` (mặc định `customer`), `status?: 'active' | 'disabled'`. Bỏ comment "Role CUSTOMER phải tồn tại trước".
- Các e2e spec có `beforeAll` upsert role → xoá đoạn đó.

## 7. Test cần viết / sửa

| Test                              | Case                                                              |
| --------------------------------- | ----------------------------------------------------------------- |
| `roles.guard.spec.ts`             | role khớp → true; không khớp → false; route không `@Roles` → true |
| `ownership.guard.spec.ts`         | `admin` bypass; `staff` không bypass                              |
| `jwt.strategy.spec.ts`            | payload cũ (`roles[]`, không `sessionVersion`) → 401 (AC4)        |
| `categories.e2e` / `products.e2e` | staff → 403, admin → 2xx (AC2)                                    |
| `auth-login.e2e` / `auth-me.e2e`  | `role === 'customer'` (AC3)                                       |

## 8. Bẫy

- Quên `prisma generate` → typecheck báo lỗi lạ ở `src/generated`.
- E2E dùng DB thật: chạy `migrate reset` cho DB test sau khi đổi migration.
- Đừng giữ song song `roles[]` "cho tương thích" — FE chưa có, giữ chỉ thêm nợ.
