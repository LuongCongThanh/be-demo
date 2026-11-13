# Report 15

- **PR:** #81
- **Ngày merge:**

## Đã làm

- `prisma/schema/identity.prisma`: `User`, `RefreshToken`, `PasswordResetToken`, `EmailVerificationToken`, enum `UserStatus` và `AccountType` chuyển vào; thêm `Role` (`name` unique, `isSystem`), `RolePermission` (PK `roleId + permission`, `permission` là string), `UserRole` (PK `userId + roleId`). `schema.prisma` còn generator, datasource và các model chưa chuyển.
- `src/common/auth/permission.enum.ts`: enum `Permission` (10 giá trị) + `STAFF_ROLE_PERMISSIONS`, `ADMIN_ROLE_PERMISSIONS` (= toàn bộ enum).
- Migration viết tay `20261113090000_rbac_roles_permissions`: kiểm tra > 1 Admin active thì `RAISE EXCEPTION` (chạy đầu tiên), đổi tên type, tạo bảng, seed Vai trò hệ thống `Admin`/`Staff`, gán `ADMIN` → `Admin`, `STAFF` → `Staff`, revoke refresh token và tăng `session_version` của mọi tài khoản nội bộ (không động tới `CUSTOMER`).
- `prisma/seed.ts`: seed hai Vai trò hệ thống (Admin đồng bộ lại theo enum mỗi lần seed, Staff chỉ tạo khi chưa có) và gán `Admin` cho tài khoản bootstrap; idempotent.
- Guard, route, JWT, response API không đổi (task 16).

## Lệch so với spec (và vì sao)

- **Quyết định về cột `role`:** giữ `users.role` (đọc bởi `@Authorize`/JWT hiện tại) đến slice F. Vì tên `Role` nay thuộc model RBAC nên enum Prisma/Postgres `Role` được đổi tên thành `AccountType` (`ALTER TYPE ... RENAME`, giữ dữ liệu); tên field vẫn là `role`. `ApiProperty` của `AuthUserResponseDto.role` vẫn giữ `enumName: 'Role'` để Swagger không đổi; task 16 nên đổi thành `AccountType` cùng lúc đổi hợp đồng `auth/me`. Test cũ chỉ đổi tên kiểu `Role` → `AccountType` ở import/kiểu.
- Chưa có nhóm `OPERATIONS_*` trong enum: hiện chưa có route vận hành nào (đơn hàng, tồn kho... thuộc slice C). Thêm cùng route ở slice đó (kèm migration cấp cho `Admin`).
- Vai trò `Staff` được cấp **chỉ Quyền xem catalog** (đúng hành vi hiện tại), không phải "Quyền vận hành" như spec viết, vì chưa có Quyền vận hành.
- Admin đã bị vô hiệu hoá (`DISABLED`) vẫn được gán Vai trò `Admin` (chỉ chặn > 1 Admin **active**).

## Quyền đề xuất

| Vai trò                          | Quyền                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Admin (hệ thống, = toàn bộ enum) | cả 10 Quyền trong `permission.enum.ts`                                         |
| Staff (hệ thống)                 | `CATALOG_PRODUCT_VIEW`, `CATALOG_CATEGORY_VIEW`, `CATALOG_PRODUCT_OPTION_VIEW` |

## Bảng route → Permission cho task 16

| Route                                                                                                          | Hiện tại             | Permission                                                        |
| -------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `GET /admin/products`, `GET /admin/products/:id`                                                               | STAFF, ADMIN         | `CATALOG_PRODUCT_VIEW`                                            |
| `POST /admin/products`, `PATCH /admin/products/:id`, `POST :id/archive`, `POST :id/unarchive`                  | ADMIN                | `CATALOG_PRODUCT_MANAGE`                                          |
| `POST /admin/products/:id/variants`, `PATCH :id/variants/:variantId`, `POST .../archive`, `POST .../unarchive` | ADMIN                | `CATALOG_PRODUCT_MANAGE`                                          |
| `POST /admin/products/:id/images`, `PATCH :id/images/:imageId`, `DELETE :id/images/:imageId`                   | ADMIN                | `CATALOG_PRODUCT_MANAGE`                                          |
| `GET /admin/categories`, `GET /admin/categories/:id`                                                           | STAFF, ADMIN         | `CATALOG_CATEGORY_VIEW`                                           |
| `POST /admin/categories`, `PATCH :id`, `DELETE :id`                                                            | ADMIN                | `CATALOG_CATEGORY_MANAGE`                                         |
| `GET /admin/sizes`, `GET /admin/colors`                                                                        | STAFF, ADMIN         | `CATALOG_PRODUCT_OPTION_VIEW`                                     |
| `POST /admin/sizes`, `PATCH /admin/sizes/:id`, `POST /admin/colors`, `PATCH /admin/colors/:id`                 | ADMIN                | `CATALOG_PRODUCT_OPTION_MANAGE`                                   |
| `GET /admin/staff`                                                                                             | ADMIN                | `ADMINISTRATION_INTERNAL_ACCOUNT_VIEW`                            |
| `POST /admin/staff`, `PATCH :id`, `POST :id/disable`, `POST :id/enable`                                        | ADMIN                | `ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE`                          |
| Task 17: liệt kê Quyền, xem Vai trò                                                                            | (mới)                | `ADMINISTRATION_ROLE_VIEW`                                        |
| Task 17: tạo/sửa/xoá Vai trò                                                                                   | (mới)                | `ADMINISTRATION_ROLE_MANAGE`                                      |
| Task 17: gán Vai trò cho Tài khoản nội bộ                                                                      | (mới)                | `ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE`                          |
| `GET /me`, `/auth/*`, route công khai                                                                          | CUSTOMER / công khai | không đổi (kiểm tra loại tài khoản, không phải Quyền back-office) |

Ghi chú cho task 16: `@Authorize('CUSTOMER')` trên `/me` là kiểm tra loại tài khoản, không có Permission tương ứng; cần giữ một cách khai báo loại tài khoản hoặc kiểm tra riêng.

## Acceptance criteria

Dry-run trên Postgres 17 docker throwaway (`docker run -d --name rbac-dryrun -e POSTGRES_PASSWORD=x -e POSTGRES_DB=t -p 55432:5432 postgres:17-alpine`, `DATABASE_URL=postgresql://postgres:x@localhost:55432/t`; container đã xoá sau khi chạy; không đụng DB chia sẻ). Mỗi lần: tạo DB mới, `prisma migrate deploy` các migration cũ, chèn dữ liệu trước-migration bằng SQL (client sinh ra đã dùng type `AccountType` nên không seed bằng Prisma trước migration được), rồi `prisma migrate deploy --config prisma7.config.ts` migration mới.

| AC                                                                                   | Kết quả                                                    | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bản thường (1 Admin, 1 Staff, 1 Customer)                                            | Thành công, đúng một Admin                                 | `roles`: Admin 10 quyền, Staff 3 quyền, cả hai `is_system`. `admin@x.com` ADMIN → Vai trò Admin, `staff@x.com` STAFF → Staff, `cust@x.com` CUSTOMER không có `user_roles`. `session_version` = 1 và refresh token bị revoke cho Admin/Staff; Customer giữ nguyên (0, không revoke). `npx tsx prisma/seed.ts` chạy hai lần liên tiếp: `Seed complete.`, vẫn 1 hàng `user_roles` của Admin, vẫn 10/3 Quyền |
| Bản 2 Admin active                                                                   | Dừng, rollback sạch                                        | `ERROR: RBAC migration aborted: found 2 active ADMIN accounts, but exactly one is allowed. Disable or demote the extra ADMIN accounts (keep one), then re-run the migration.` (P0001). Sau đó không có bảng `roles`, type `Role` còn nguyên. Vô hiệu hoá Admin thừa, `prisma migrate resolve --rolled-back 20261113090000_rbac_roles_permissions`, `migrate deploy` lại: thành công                      |
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code` | `No difference detected.`                                  | DB đã áp dụng toàn bộ migration                                                                                                                                                                                                                                                                                                                                                                          |
| typecheck, lint, build                                                               | pass (lint chỉ còn warning cũ `no-explicit-any`)           |                                                                                                                                                                                                                                                                                                                                                                                                          |
| API cũ chạy như trước                                                                | Guard, route, JWT không đổi; `enumName: 'Role'` giữ nguyên | Swagger không đổi                                                                                                                                                                                                                                                                                                                                                                                        |
