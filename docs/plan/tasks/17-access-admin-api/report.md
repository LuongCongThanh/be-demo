# Report 17

- **PR:** #PRNUM
- **Ngày merge:**

## Đã làm

- `src/modules/identity/access/`: `AccessService` (export từ `IdentityModule`), `AdminRoleController`, `dto/`. API (mọi route dưới `/api/v1`):

| Route                                                                                                           | Permission                               |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `GET /admin/permissions` (Quyền kèm nhóm theo tiền tố), `GET /admin/roles` (phân trang), `GET /admin/roles/:id` | `ADMINISTRATION_ROLE_VIEW`               |
| `POST /admin/roles`, `PATCH /admin/roles/:id`, `DELETE /admin/roles/:id`                                        | `ADMINISTRATION_ROLE_MANAGE`             |
| `GET /admin/internal-accounts/:accountId/roles`                                                                 | `ADMINISTRATION_INTERNAL_ACCOUNT_VIEW`   |
| `PUT` / `DELETE /admin/internal-accounts/:accountId/roles/:roleId` (gán / gỡ, nhiều Vai trò mỗi tài khoản)      | `ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE` |

- Mọi thay đổi ảnh hưởng Quyền hiệu lực của tài khoản (gán, gỡ Vai trò; đổi Quyền hoặc tên của Vai trò đang được gán) chạy trong **một `prisma.`**: thay đổi + `session_version += 1` + thu hồi refresh token còn hiệu lực của mọi tài khoản bị ảnh hưởng + `auditLog.record(tx, …)` (`role.create|update|delete`, `account.role.assign|remove`). Theo đúng luồng disable, vì `/auth/refresh` không so `sessionVersion`. Gán lặp lại (đã giữ Vai trò) là no-op: không ghi audit, không thu hồi phiên.
- Bất biến:
  - Vai trò `Admin`: mọi sửa (Quyền, tên, mô tả) bị từ chối (409), Quyền luôn bằng enum trong code.
  - Vai trò hệ thống (`Admin`, `Staff`) không xoá được, không đổi tên được (code tra theo tên); `Staff` được sửa Quyền/mô tả.
  - Vai trò `Admin` chỉ gán được khi chưa tài khoản khác giữ (409 nếu có); không gỡ được khỏi Admin active duy nhất (409); tài khoản giữ Vai trò `Admin` không vô hiệu hoá được (`InternalAccountService.setStaffStatus` gọi `AccessService.assertNotAdminHolder`, 409). Không có API xoá tài khoản nội bộ nên "xoá" không có đường vào. Khoá dòng (`FOR UPDATE` Vai trò rồi user, cùng thứ tự ở mọi chỗ) chặn hai request đồng thời cùng gán Admin.
  - Tên Vai trò unique không phân biệt hoa thường (pre-check `mode: insensitive` + unique DB, 409).
- **Quyết định: Vai trò còn đang được gán thì xoá bị TỪ CHỐI (409), không cascade.** Lý do: cascade âm thầm tước Quyền của nhiều tài khoản qua một thao tác xoá; gỡ từng tài khoản là thao tác có chủ đích, có audit và thu hồi phiên riêng. FK `user_roles.role_id` đã là `Restrict` nên DB cũng chặn.
- Swagger: thêm tag `Roles & Permissions`; mô tả "(ADMIN only)" của `admin/staff` đổi thành "(requires ADMINISTRATION_INTERNAL_ACCOUNT_VIEW|MANAGE)", tag `Staff Management` cập nhật. `docs/openapi/openapi.json` sinh lại bằng `npm run openapi:write`.
- Tài liệu: `docs/architecture/modules/identity.md` §5.3b.

## Lệch so với spec và rủi ro còn lại

- **CLI `create-admin` vẫn tạo được Admin thứ hai** (và `InternalAccountService.create` gán Vai trò `Admin` cho nó). Bất biến "đúng một Admin active" chỉ được thực thi ở API Vai trò/tài khoản. Chặn ở `create` sẽ làm đổi hành vi `test/cli-create-admin.e2e-spec.ts` (tạo nhiều Admin) nên không làm trong ticket này; cần ticket riêng (CLI từ chối khi đã có Admin, hoặc không gán Vai trò `Admin` cho Admin thứ hai).
- Mô tả "(ADMIN only)" của các route catalog (categories, products, sizes, colors) vẫn còn: ngoài phạm vi module `identity`, ticket chỉ yêu cầu `admin/staff`.
- Chưa chạy `npm run postman:sync` (cần khoá Postman thật).
- Danh sách Vai trò phân trang theo `PaginationDto` (mặc định 20).

## Test cũ đã chạm (chỉ cơ chế)

| File                                                                     | Thay đổi                                                                                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/modules/identity/internal-account/internal-account.service.spec.ts` | Constructor `InternalAccountService` có thêm tham số `AccessService`: truyền stub `{ assertNotAdminHolder: vi.fn() }` ở hai chỗ dựng service; assertion không đổi. |

Không có test mới.

## Kiểm tra

- `npm run typecheck`, `npm run lint` (chỉ còn warning cũ `no-explicit-any`), `npm run test` (240 pass), `npm run openapi:write` pass; Prettier sạch trên file đã đổi.

## Acceptance criteria: chạy tay trên API local

Postgres 17 + Redis 8 docker throwaway (`acc17-pg` :55437, `acc17-redis` :56387, đã xoá sau khi chạy; không đụng DB chia sẻ), `prisma migrate deploy` + `prisma/seed.ts`, API `node dist/main` cổng 3017, kịch bản bằng curl chạy một mạch trên DB mới. Mỗi dòng cuối là mã HTTP; token và `requestId` bị cắt.

- Tạo Vai trò `Merchandiser`, tick Quyền, gán cho Staff: `session_version` 0 → 1, refresh token hoạt động 1 → 0 (bước 5).
- Access token cũ → 401, refresh token cũ → 401 "Refresh token has been revoked" (bước 5).
- Staff đăng nhập lại: claims có `Merchandiser` và `CATALOG_CATEGORY_MANAGE`, gọi được `POST /admin/categories` (bước 6).
- Sửa Quyền Vai trò đang gán: token và refresh token cấp trước đó cùng bị từ chối (bước 7).
- Sửa/xoá `Admin`, gỡ Admin khỏi Admin duy nhất, gán Admin cho tài khoản thứ hai, vô hiệu hoá tài khoản giữ Admin: đều bị từ chối (bước 10).
- Audit: đủ 5 loại dòng (cuối bước 12).

```
== 1. admin: list permissions (grouped)
[{"group":"CATALOG","permissions":["CATALOG_PRODUCT_VIEW","CATALOG_PRODUCT_MANAGE","CATALOG_CATEGORY_VIEW","CATALOG_CATEGORY_MANAGE","CATALOG_PRODUCT_OPTION_VIEW","CATALOG_PRODUCT_OPTION_MANAGE"]},{"group":"ADMINISTRATION","permissions":["ADMINISTRATION_ROLE_VIEW","ADMINISTRATION_ROLE_MANAGE","ADMINISTRATION_INTERNAL_ACCOUNT_VIEW","ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE"]}] [HTTP 200]
== 2. admin: list roles
== 3. create Staff account
{"id":"cd2251e8-306d-4559-9ea8-a1a393590259","email":"staff1@x.com","name":"Staff One","status":"ACTIVE","createdAt":"…","updatedAt":"…"} [HTTP 201]
staff claims before:
{"email":"staff1@x.com","roles":["Staff"],"permissions":["CATALOG_CATEGORY_VIEW","CATALOG_PRODUCT_OPTION_VIEW","CATALOG_PRODUCT_VIEW"],"sessionVersion":0}
-- staff cannot call GET /admin/roles (no ADMINISTRATION_ROLE_VIEW)
{"statusCode":403,"message":"Forbidden resource","requestId":"…"} [HTTP 403]
-- staff cannot create product (no CATALOG_PRODUCT_MANAGE)
{"statusCode":403,"message":"Forbidden resource","requestId":"…"} [HTTP 403]
== 4. admin creates Role 'Merchandiser' ticking permissions
{"id":"5ae5a959-da23-481c-b5fd-af4c413350ae","name":"Merchandiser","description":"Manage categories","isSystem":false,"permissions":["CATALOG_CATEGORY_MANAGE","CATALOG_CATEGORY_VIEW"],"accountCount":0,"createdAt":"…","updatedAt":"…"} [HTTP 201]
-- duplicate name (case-insensitive) rejected
{"statusCode":409,"message":"Role name is already in use","requestId":"…"} [HTTP 409]
-- unknown permission rejected
{"statusCode":400,"message":["each value in permissions must be one of the following values: CATALOG_PRODUCT_VIEW, CATALOG_PRODUCT_MANAGE, CATALOG_CATEGORY_VIEW, CATALOG_CATEGORY_MANAGE, CATALOG_PRODUCT_OPTION_VIEW, CATALOG_PRODUCT_OPTION_MANAGE, ADMINISTRATION_ROLE_VIEW, ADMINISTRATION_ROLE_MANAGE, ADMINISTRATION_INTERNAL_ACCOUNT_VIEW, ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE"],"requestId":"…"} [HTTP 400]
== 5. assign to Staff (staff is logged in meanwhile with old tokens)
before: session_version=0 active_refresh_tokens=1
{"accountId":"cd2251e8-306d-4559-9ea8-a1a393590259","roles":[{"id":"5ae5a959-da23-481c-b5fd-af4c413350ae","name":"Merchandiser","isSystem":false},{"id":"4bd5f380-4f54-4cca-9d0a-e7baf6664a21","name":"Staff","isSystem":true}]} [HTTP 200]
after:  session_version=1 active_refresh_tokens=0
-- idempotent re-assign
{"accountId":"cd2251e8-306d-4559-9ea8-a1a393590259","roles":[{"id":"5ae5a959-da23-481c-b5fd-af4c413350ae","name":"Merchandiser","isSystem":false},{"id":"4bd5f380-4f54-4cca-9d0a-e7baf6664a21","name":"Staff","isSystem":true}]} [HTTP 200]
-- old access token now 401
{"statusCode":401,"message":"Unauthorized","requestId":"…"} [HTTP 401]
-- OLD refresh token rejected
{"statusCode":401,"message":"Refresh token has been revoked — all login sessions have been logged out for security reasons","requestId":"…"} [HTTP 401]
== 6. staff logs in again -> new claims
{"email":"staff1@x.com","roles":["Merchandiser","Staff"],"permissions":["CATALOG_CATEGORY_MANAGE","CATALOG_CATEGORY_VIEW","CATALOG_PRODUCT_OPTION_VIEW","CATALOG_PRODUCT_VIEW"],"sessionVersion":1}
-- staff can now create a category
{"id":"e7d9a4d4-d977-4ba4-a155-f49f78812bd4","parentId":null,"name":"Acc17 Cat","slug":"acc17-cat","description":null,"sortOrder":0,"isVisible":true,"createdAt":"2026-11-13T02:44:55.328Z","updatedAt":
-- new refresh token works
[HTTP 200]
== 7. edit role permissions -> holders' sessions end
{"id":"5ae5a959-da23-481c-b5fd-af4c413350ae","name":"Merchandiser","description":"Manage categories","isSystem":false,"permissions":["CATALOG_CATEGORY_VIEW"],"accountCount":1,"createdAt":"…","updatedAt":"…"} [HTTP 200]
-- token before edit -> 401
{"statusCode":401,"message":"Unauthorized","requestId":"…"} [HTTP 401]
-- refresh from before edit rejected
{"statusCode":401,"message":"Refresh token has been revoked — all login sessions have been logged out for security reasons","requestId":"…"} [HTTP 401]
== 8. list account roles
{"accountId":"cd2251e8-306d-4559-9ea8-a1a393590259","roles":[{"id":"5ae5a959-da23-481c-b5fd-af4c413350ae","name":"Merchandiser","isSystem":false},{"id":"4bd5f380-4f54-4cca-9d0a-e7baf6664a21","name":"Staff","isSystem":true}]} [HTTP 200]
== 9. delete role still assigned -> rejected
{"statusCode":409,"message":"Role is still assigned to 1 account(s); remove it from them first","requestId":"…"} [HTTP 409]
== 10. Admin invariants
-- edit Admin role (permissions)
{"statusCode":409,"message":"The Admin role is read-only: it always holds every permission","requestId":"…"} [HTTP 409]
-- edit Admin role (name)
{"statusCode":409,"message":"The Admin role is read-only: it always holds every permission","requestId":"…"} [HTTP 409]
-- delete Admin role
{"statusCode":409,"message":"System roles cannot be deleted","requestId":"…"} [HTTP 409]
-- delete Staff (system) role
{"statusCode":409,"message":"System roles cannot be deleted","requestId":"…"} [HTTP 409]
-- rename Staff (system) role
{"statusCode":409,"message":"System roles cannot be renamed","requestId":"…"} [HTTP 409]
-- remove Admin role from the sole active Admin
{"statusCode":409,"message":"The sole active Admin account cannot lose the Admin role","requestId":"…"} [HTTP 409]
-- assign Admin role to a second account
{"statusCode":409,"message":"The Admin role is already assigned to another account","requestId":"…"} [HTTP 409]
-- disable the Admin (via staff endpoint: not a Staff account)
{"statusCode":404,"message":"Staff account not found","requestId":"…"} [HTTP 404]
-- disable guard: force-grant Admin role to the Staff account by SQL, then disable it
{"statusCode":409,"message":"The sole active Admin account cannot be disabled","requestId":"…"} [HTTP 409]
ACTIVE
== 11. remove the custom role from Staff, then delete the role
{"accountId":"cd2251e8-306d-4559-9ea8-a1a393590259","roles":[{"id":"4bd5f380-4f54-4cca-9d0a-e7baf6664a21","name":"Staff","isSystem":true}]} [HTTP 200]
{"statusCode":404,"message":"The account does not hold this role","requestId":"…"} [HTTP 404]
 [HTTP 204]
-- role 404
{"statusCode":404,"message":"Role not found","requestId":"…"} [HTTP 404]
== 12. audit rows
role.create|role|5ae5a959|t|-|{"name": "Merchandiser", "description": "Manage categories", "permissions": ["CATALOG_CATEGORY_MANAGE", "CATAL
account.role.assign|user|cd2251e8|t|{"roles": ["Staff"]}|{"roles": ["Merchandiser", "Staff"], "assigned": "Merchandiser"}
role.update|role|5ae5a959|t|{"name": "Merchandiser", "description": "Manage categories", "permissi|{"name": "Merchandiser", "description": "Manage categories", "permissions": ["CATALOG_CATEGORY_VIEW"], "sessio
account.role.remove|user|cd2251e8|t|{"roles": ["Merchandiser", "Staff"]}|{"roles": ["Staff"], "removed": "Merchandiser"}
role.delete|role|5ae5a959|t|{"name": "Merchandiser", "description": "Manage categories", "permissi|-
-- audit rows count by action
account.role.assign|1
account.role.remove|1
role.create|1
role.delete|1
role.update|1
```
