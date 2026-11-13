# Report 18

- **PR:** TBD
- **Ngày merge:**

## Đã làm

- `GET /admin/staff/:id` (`ADMINISTRATION_INTERNAL_ACCOUNT_VIEW`): `InternalAccountService.findOneStaff`, cùng quy tắc `role: STAFF` → id của Admin/Khách hàng trả 404.
- `StaffResponseDto.roles: RoleSummaryResponseDto[]` (id, tên, `isSystem`), sắp theo tên Vai trò. Mọi truy vấn Staff (`findAllStaff`, `findStaffOrThrow`, `update` khi đổi tên / disable / enable) dùng chung `include` `WITH_ROLES`; `createStaff` đọc lại tài khoản sau khi tạo để trả cả Vai trò `Staff` vừa gán.
- `docs/openapi/openapi.json` sinh lại bằng `npm run openapi:write`.
- `docs/plan/README.md`: thêm dòng task 18; sửa dòng task 16 đang ghi `todo` thành `done` (#82).

## Lệch so với spec và rủi ro còn lại

- Không có. Danh sách Staff vẫn chưa có tìm kiếm / lọc (ngoài phạm vi).

## Test cũ đã chạm (chỉ cơ chế)

| File                                                                     | Thay đổi                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/identity/internal-account/internal-account.service.spec.ts` | Fixture `staff()` có `userRoles`; stub `prisma.user.findFirst` cho `createStaff`; kết quả mong đợi của `createStaff` có `roles`; tham số gọi `findFirst` / `update` mong đợi có thêm `include`. |

Không có test mới.

## Kiểm tra

- `npm run typecheck`, `npm run lint` (chỉ còn warning cũ `no-explicit-any`), `npm run test` (240 pass), `npm run openapi:write` pass.

## Acceptance criteria: chạy tay trên API local

Postgres 17 + Redis 8 docker throwaway (`acc18-pg` :55438, `acc18-redis` :56388), `prisma migrate deploy` + `prisma/seed.ts`, API `node dist/main` cổng 3018, kịch bản curl chạy một mạch trên DB mới. `requestId` bị cắt.

```
== 1. create staff
{"id":"0dc076df-…","email":"s1@acc18.local","name":"Staff Mot","status":"ACTIVE","roles":[{"id":"7f3c95e1-…","name":"Staff","isSystem":true}],…}
== 2. GET /admin/staff/:id
{"id":"0dc076df-…","email":"s1@acc18.local","name":"Staff Mot","status":"ACTIVE","roles":[{"id":"7f3c95e1-…","name":"Staff","isSystem":true}],…} [HTTP 200]
== 3. GET /admin/staff/:id with admin id -> 404
{"statusCode":404,"message":"Staff account not found","requestId":"…"} [HTTP 404]
== 4. staff token (no INTERNAL_ACCOUNT_VIEW) -> 403
{"statusCode":403,"message":"Forbidden resource","requestId":"…"} [HTTP 403]
== 5. create role Kho, assign to staff, GET again (sorted by name)
{"accountId":"0dc076df-…","roles":[{"id":"42ab5c19-…","name":"Kho","isSystem":false},{"id":"7f3c95e1-…","name":"Staff","isSystem":true}]} [HTTP 200]
{"id":"0dc076df-…",…,"roles":[{"id":"42ab5c19-…","name":"Kho","isSystem":false},{"id":"7f3c95e1-…","name":"Staff","isSystem":true}],…} [HTTP 200]
== 6. list has roles per row
{"data":[{"id":"0dc076df-…",…,"roles":[{"name":"Kho",…},{"name":"Staff",…}],…}],"meta":{"page":1,"limit":10,"total":1,"totalPages":1}} [HTTP 200]
```
