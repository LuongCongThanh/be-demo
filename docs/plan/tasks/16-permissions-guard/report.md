# Report 16

- **PR:** #82
- **Ngày merge:**

## Đã làm

- `@Authorize(...Permission)` thay `@Authorize(...Role)`: `roles.guard.ts` → `permissions.guard.ts` (`PermissionsGuard`), `roles.decorator.ts` → `permissions.decorator.ts`. Guard cho qua khi `request.user.permissions` có **mọi** Quyền khai báo; không khai Quyền = chỉ cần đăng nhập. Token kiểu cũ thiếu `permissions` bị coi là không có Quyền nào (403). Lint `no-restricted-imports` đổi sang chặn import trực tiếp `permissions.guard`/`permissions.decorator`.
- `modules/identity/auth/access-claims.service.ts` (`AccessClaimsService`): tính `roles[]`, `permissions[]` từ `UserRole` → `Role` → `RolePermission` lúc login và refresh (`SessionService.signAccessToken`). Vai trò hệ thống `Admin` = `ADMIN_ROLE_PERMISSIONS` (toàn bộ enum trong code, không đọc hàng `role_permissions`). Chuỗi Quyền lạ trong DB bị bỏ. Khách hàng: `[]`, không truy vấn DB. Không đọc database cho Quyền ở mỗi request.
- JWT payload: thêm `roles: string[]`, `permissions: Permission[]` (giữ `role` = loại tài khoản và `sessionVersion`).
- `GET /auth/me` trả thêm `roles[]`, `permissions[]` (lấy từ token, đúng thứ guard đang áp dụng) qua `MeResponseDto`. Response của login/register giữ `AuthUserResponseDto`, **không đổi**.
- Kiểm loại tài khoản tách khỏi Quyền: `@AuthorizeAccountType('CUSTOMER')` + `AccountTypeGuard` (`src/common/auth/`), dùng cho `GET /me`. Admin/Staff gọi `/me` vẫn 403 như trước.
- Gán Quyền cho route theo bảng của task 15: catalog (products, categories, sizes, colors) và `admin/staff` (class `*_VIEW`, method ghi ghi đè `*_MANAGE`).
- Swagger: `enumName` của `AuthUserResponseDto.role` đổi `Role` → `AccountType`; thêm enum `Permission` và `MeResponseDto`; mô tả 403 đổi thành "lacks the required permission or account type". `docs/openapi/openapi.json` đã sinh lại bằng `npm run openapi:write`.
- Tài liệu: `docs/convention/api-rules.md`, `api-crud-walkthrough.md`, `docs/architecture/05-auth-security.md`, `03-api.md` cập nhật theo `@Authorize(Permission)`.

## Lệch so với spec (và vì sao)

- **`InternalAccountService.create` nay gán Vai trò hệ thống** (`Staff` cho STAFF, `Admin` cho ADMIN, cùng transaction với tạo user). Spec không nêu, nhưng nếu không làm thì Staff tạo qua `POST /admin/staff` và Admin tạo qua CLI sau task 15 không có `user_roles` nên mất toàn bộ Quyền (403 ở mọi route). Task 17 (gán Vai trò) sẽ chỉnh lại chỗ này.
- **Refresh token và `sessionVersion`:** hiện trạng **không** so `sessionVersion` ở `/auth/refresh` (bản ghi `refresh_tokens` không lưu version). Việc từ chối refresh khi đổi phiên đang dựa vào việc **thu hồi refresh token cùng transaction với lúc tăng `session_version`** (disable tài khoản, migration task 15). Đã chứng minh bên dưới: sau disable thì access token cũ 401 và refresh 401; nhưng nếu chỉ tăng `session_version` mà không thu hồi token thì refresh vẫn 200 (và cấp token mang Quyền tính mới). Không đổi schema trong task này. **Task 17 (đổi Vai trò → tăng `session_version`) phải thu hồi refresh token trong cùng transaction**, hoặc thêm cột `session_version` vào `refresh_tokens`.
- Các route `admin/staff` giữ mô tả Swagger "(ADMIN only)": đúng thực tế hiện tại (chỉ Admin có Quyền đó), sẽ lỗi thời khi task 17 cho tạo Vai trò tuỳ chỉnh.
- Chưa chạy `npm run postman:sync` (cần `POSTMAN_API_KEY`/collection thật, ghi vào dịch vụ ngoài). Cần làm sau merge.
- Token Khách hàng cũ (cấp trước deploy) không có `permissions`/`roles` vẫn hợp lệ (guard coi là `[]`; Khách hàng không cần Quyền). Token Staff/Admin cũ đã mất hiệu lực ở migration task 15 (tăng `session_version`).

## Test cũ đã chạm (chỉ cơ chế, không đổi ý nghĩa assertion)

| File                                                                           | Thay đổi                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/common/auth/permissions.guard.spec.ts` (đổi tên từ `roles.guard.spec.ts`) | `RolesGuard`/`ROLES_KEY` → `PermissionsGuard`/`PERMISSIONS_KEY`; user fixture dùng `permissions[]` thay `role`; vẫn đúng 5 test cũ, cùng ý (qua khi không khai; đọc metadata theo key; chặn khi thiếu user; chặn khi thiếu; qua khi đủ). |
| `src/common/auth/authorize.decorator.spec.ts`                                  | Đối số `@Authorize('STAFF','ADMIN')` → `Permission.*`, tên guard/key; assertion giữ nguyên.                                                                                                                                              |
| `src/modules/identity/auth/session.service.spec.ts`                            | Thêm stub `AccessClaimsService` vào constructor; payload JWT kỳ vọng thêm `roles: []`, `permissions: []`.                                                                                                                                |
| `src/modules/identity/auth/jwt.strategy.spec.ts`                               | Fixture payload thêm `roles: []`, `permissions: []` (kiểu `JwtPayload`).                                                                                                                                                                 |
| `src/modules/identity/auth/account-profile.service.spec.ts`                    | `getMe` nhận claims; body kỳ vọng thêm `roles: []`, `permissions: []` (đổi hợp đồng `auth/me` theo spec).                                                                                                                                |
| `test/auth-me.e2e-spec.ts`                                                     | Body kỳ vọng của Khách hàng thêm `roles: []`, `permissions: []` (đổi hợp đồng `auth/me` theo spec).                                                                                                                                      |
| `test/support/create-test-user.ts` (helper)                                    | User test STAFF/ADMIN được gán Vai trò hệ thống `Staff`/`Admin` (đã seed bởi migration), vì Quyền nay đến từ `user_roles`, không từ cột `role`.                                                                                          |

Không có file test mới trong PR.

## Kiểm tra

- `npm run typecheck`, `npm run lint` (chỉ còn warning cũ `no-explicit-any`), `npm run test` (240 pass), `npm run openapi:write` (gồm `nest build`) pass; Prettier sạch trên file đã đổi.
- e2e toàn bộ trên Postgres docker throwaway: 175 pass, 1 skipped (skip có sẵn).

## Acceptance criteria: chạy tay trên API local

Môi trường: Postgres 17 + Redis 8 docker throwaway (`perm16-pg` :55433, `perm16-redis` :56380, đã xoá sau khi chạy; không đụng DB chia sẻ), `prisma migrate deploy` + `prisma/seed.ts`, API `node dist/main` cổng 3016. Staff tạo qua `POST /admin/staff`, Khách hàng tạo qua `POST /auth/register` rồi đặt `email_verified_at` bằng SQL. Token cắt thành `<jwt>`. Ma trận: mỗi dòng là mã HTTP của Admin, Staff và không token.

```
== login admin
{"accessToken":"<jwt>","user":{"id":"0baf09e2-d6d7-4080-ad44-db0035dda7d6","email":"admin@x.com","fullName":"Admin","role":"ADMIN","emailVerified":true}}
== JWT claims admin
{"sub":"0baf09e2-d6d7-4080-ad44-db0035dda7d6","email":"admin@x.com","role":"ADMIN","roles":["Admin"],"permissions":["ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE","ADMINISTRATION_INTERNAL_ACCOUNT_VIEW","ADMINISTRATION_ROLE_MANAGE","ADMINISTRATION_ROLE_VIEW","CATALOG_CATEGORY_MANAGE","CATALOG_CATEGORY_VIEW","CATALOG_PRODUCT_MANAGE","CATALOG_PRODUCT_OPTION_MANAGE","CATALOG_PRODUCT_OPTION_VIEW","CATALOG_PRODUCT_VIEW"],"sessionVersion":0,"iat":1794537172,"exp":1794538072}
== admin GET /auth/me
{"id":"0baf09e2-d6d7-4080-ad44-db0035dda7d6","email":"admin@x.com","fullName":"Admin","role":"ADMIN","emailVerified":true,"roles":["Admin"],"permissions":["ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE","ADMINISTRATION_INTERNAL_ACCOUNT_VIEW","ADMINISTRATION_ROLE_MANAGE","ADMINISTRATION_ROLE_VIEW","CATALOG_CATEGORY_MANAGE","CATALOG_CATEGORY_VIEW","CATALOG_PRODUCT_MANAGE","CATALOG_PRODUCT_OPTION_MANAGE","CATALOG_PRODUCT_OPTION_VIEW","CATALOG_PRODUCT_VIEW"]}
== create staff via API (admin)
{"id":"47dc6007-beb3-4d15-a00d-9772780ae9b0","email":"staff1@x.com","name":"Staff One","status":"ACTIVE","createdAt":"2026-11-13T02:32:52.336Z","updatedAt":"2026-11-13T02:32:52.336Z"}
== login staff
{"accessToken":"<jwt>","user":{"id":"47dc6007-beb3-4d15-a00d-9772780ae9b0","email":"staff1@x.com","fullName":"Staff One","role":"STAFF","emailVerified":true}}
{"sub":"47dc6007-beb3-4d15-a00d-9772780ae9b0","email":"staff1@x.com","role":"STAFF","roles":["Staff"],"permissions":["CATALOG_CATEGORY_VIEW","CATALOG_PRODUCT_OPTION_VIEW","CATALOG_PRODUCT_VIEW"],"sessionVersion":0,"iat":1794537172,"exp":1794538072}
== staff GET /auth/me
{"id":"47dc6007-beb3-4d15-a00d-9772780ae9b0","email":"staff1@x.com","fullName":"Staff One","role":"STAFF","emailVerified":true,"roles":["Staff"],"permissions":["CATALOG_CATEGORY_VIEW","CATALOG_PRODUCT_OPTION_VIEW","CATALOG_PRODUCT_VIEW"]}
-- matrix (route | admin | staff | no token)
GET /admin/products                              admin=200 staff=200 anon=401
GET /admin/products/09fd2c62-c2ba-41ed-872c-e4e75ada625a admin=200 staff=200 anon=401
GET /admin/categories                            admin=200 staff=200 anon=401
GET /admin/sizes                                 admin=200 staff=200 anon=401
GET /admin/colors                                admin=200 staff=200 anon=401
GET /admin/staff                                 admin=200 staff=403 anon=401
POST /admin/categories                           admin=400 staff=403 anon=401
POST /admin/products                             admin=400 staff=403 anon=401
POST /admin/sizes                                admin=400 staff=403 anon=401
POST /admin/staff                                admin=400 staff=403 anon=401
PATCH /admin/products/09fd2c62-c2ba-41ed-872c-e4e75ada625a admin=200 staff=403 anon=401
== customer: register + verify (SQL) + login
register=201
customer login body: {"accessToken":"<jwt>","user":{"id":"b91a51b0-9801-42c3-bce7-67a8d4e0d8bf","email":"cust1@x.com","fullName":"Cust One","role":"CUSTOMER","emailVerified":true}}
{"sub":"b91a51b0-9801-42c3-bce7-67a8d4e0d8bf","email":"cust1@x.com","role":"CUSTOMER","roles":[],"permissions":[],"sessionVersion":0,"iat":1794537172,"exp":1794538072}
customer GET /auth/me:
{"id":"b91a51b0-9801-42c3-bce7-67a8d4e0d8bf","email":"cust1@x.com","fullName":"Cust One","role":"CUSTOMER","emailVerified":true,"roles":[],"permissions":[]}
customer GET /me:
{"id":"b91a51b0-9801-42c3-bce7-67a8d4e0d8bf","email":"cust1@x.com","fullName":"Cust One","phone":"0912345678"}
admin GET /me (account-type check, expect 403): 403
staff GET /me (expect 403): 403
customer back-office:
  GET /admin/products -> 403
  GET /admin/categories -> 403
  GET /admin/sizes -> 403
  GET /admin/staff -> 403
  POST /admin/categories -> 403
== refresh (admin jar): new token claims
{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWI
{"sub":"0baf09e2-d6d7-4080-ad44-db0035dda7d6","email":"admin@x.com","role":"ADMIN","roles":["Admin"],"permissions":["ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE","ADMINISTRATION_INTERNAL_ACCOUNT_VIEW","ADMINISTRATION_ROLE_MANAGE","ADMINISTRATION_ROLE_VIEW","CATALOG_CATEGORY_MANAGE","CATALOG_CATEGORY_VIEW","CATALOG_PRODUCT_MANAGE","CATALOG_PRODUCT_OPTION_MANAGE","CATALOG_PRODUCT_OPTION_VIEW","CATALOG_PRODUCT_VIEW"],"sessionVersion":0,"iat":1794537173,"exp":1794538073}
```

Kết quả: Admin 200 ở mọi route; Staff 200 ở route xem (products, categories, sizes, colors), 403 ở `admin/staff` và mọi route ghi; Khách hàng 403 ở toàn bộ back-office; không token 401. Admin/Staff gọi `GET /me` (Khách hàng) 403. Đăng nhập Khách hàng: body không đổi (không có `roles`/`permissions`), `GET /me` không đổi.

### Route khai báo 2 Quyền, thiếu 1 thì từ chối

Không có route thật nào khai 2 Quyền (bảng task 15 mỗi route đúng 1), nên "tất cả" được kiểm bằng một controller **tạm** (không commit) `GET /zz-two` với `@Authorize(CATALOG_PRODUCT_VIEW, CATALOG_PRODUCT_MANAGE)`, gắn vào app thật qua `Test.createTestingModule({ imports: [AppModule, TwoModule] })` với login thật và DB thật:

```
ZZ admin (Admin role missing CATALOG_PRODUCT_MANAGE row in DB, still full enum from code): 200
ZZ staff (VIEW only): 403
ZZ custom role MANAGE only (missing VIEW): 403
ZZ custom role VIEW+MANAGE: 200
```

Dòng đầu cũng chứng minh Admin lấy toàn bộ Quyền từ enum trong code: hàng `role_permissions` `CATALOG_PRODUCT_MANAGE` của Vai trò `Admin` đã bị xoá tạm khi chạy (khôi phục sau đó), Admin vẫn 200.

### Refresh / sessionVersion

```
before disable: staff GET /admin/products=200
admin disables staff: 200
after disable: old access token=401 ; refresh with old cookie=401
-- sessionVersion bump WITHOUT token revoke:
old access token=401; refresh with old cookie=200
```

Dòng cuối là gap đã nêu ở phần Lệch so với spec.

### Swagger

`GET /docs-json` (và `docs/openapi/openapi.json`): schema `Permission` (10 giá trị), `AccountType` (thay `Role`), `MeResponseDto` với `roles` và `permissions` bắt buộc; login vẫn trả `AuthUserResponseDto` (không có `roles`/`permissions`).
