# Plan 01: Mô hình bốn vai trò

Branch: `refactor/four-actor-roles` (từ `dev`). Một PR, có `!` trong tiêu đề (breaking: JWT payload + response login đổi).

## Các bước

1. [ ] Ghi metric "trước" vào [metric.md](./metric.md).
2. [ ] **Schema:** sửa `prisma/schema/enums.prisma` + `schema.prisma` (enum `Role`, `UserStatus`, cột `role`, `session_version`; bỏ model `Role`, `UserRole`).
3. [ ] **Migration:** `npx prisma migrate dev --create-only --name four_actor_roles`, rồi **viết lại SQL bằng tay** theo [guide.md §2](./guide.md#2-migration-sql). Chạy trên DB dev có dữ liệu cũ để kiểm AC1.
4. [ ] `npx prisma generate`; để `typecheck` chỉ ra mọi chỗ gãy.
5. [ ] **Auth core:** `JwtPayload`, `signAccessToken`, `JwtStrategy.validate`, `register` (gán `role: 'customer'`), response DTO login/me.
6. [ ] **Guards:** `Roles` decorator nhận `Role`; `RolesGuard` so `user.role`; `OwnershipGuard` bypass `admin`.
7. [ ] **Controllers:** categories/products write → `@Roles('admin')`. Kiểm `api-tags.ts`.
8. [ ] **Seed + test helper:** `prisma/seed.ts`, `test/support/create-test-user.ts` (thêm option `role`).
9. [ ] **Tests:** sửa unit (`roles.guard`, `ownership.guard`, `jwt.strategy`, `auth.service`) + e2e; thêm case AC2, AC3, AC4.
10. [ ] Chạy AC5 grep; `lint`, `typecheck`, `test`, `test:e2e`.
11. [ ] Swagger: kiểm response login/me hiện `role` enum; `npm run postman:sync`.
12. [ ] Ghi metric "sau"; `/code-review`; `/ship`.
13. [ ] Sau merge: viết [report.md](./report.md), đặt `status: done`, `pr: #NN` trong spec, cập nhật [bảng tổng](../../README.md).

## Rủi ro

- Migration đổi kiểu dữ liệu → phải hand-write, có `BEGIN/COMMIT` ngầm của Prisma; thử trên bản sao DB trước.
- Bỏ bảng `roles` là **khó đảo ngược** nhưng đã được ADR 0005 quyết; không cần ADR mới.
