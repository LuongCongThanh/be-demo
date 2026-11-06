---
status: todo
pr:
blocked-by: [01-rename-roles]
---

# Spec 02: Login trả role, quản lý Staff, CLI create-admin

Branch: `feature/backoffice-login-and-staff-management` · Plan tổng: [PR 2](../../realign-identity-catalog.md)

## Problem Statement

Sau task 01 đã có ba vai trò, nhưng vẫn còn các lỗ hổng:

- Không có cách hợp lệ để tạo Admin. Hiện chỉ có seed từ env.
- Admin không quản lý được Staff: không tạo, đổi tên, vô hiệu hoá hay kích hoạt lại được.
- Route back-office và route mua hàng chưa tách theo vai trò, nên Staff có thể gọi route của khách và khách có thể gọi `/admin/*`.
- Khi một Staff nghỉ việc, các phiên đăng nhập của họ vẫn còn sống cho tới khi access token hết hạn.
- Đăng ký bằng email của tài khoản nội bộ chưa bị chặn, trái quy tắc mỗi email một Tài khoản.
- Không có dấu vết ai đã tạo hoặc vô hiệu hoá Staff.

## Solution

- Mọi vai trò dùng chung một endpoint login, và response trả `role`. FE tự từ chối nếu vai trò không đúng kênh, còn server chặn bằng `@Roles` trên từng route (ADR 0005).
- Admin đầu tiên được tạo bằng lệnh CLI `create-admin`. Lệnh nhập mật khẩu qua prompt.
- Admin quản lý Staff qua `/api/v1/admin/staff`. Vô hiệu hoá Staff sẽ tăng `session_version`, nên request kế tiếp của Staff đó bị 401 ngay.
- Mỗi thao tác quản lý Staff ghi một dòng `audit_logs`.

## User Stories

1. As any user, I want one login endpoint for all roles, so that FE and BE have a single auth flow.
2. As a FE developer, I want the login response to include `role`, so that the storefront can reject internal accounts and the back-office can reject customers.
3. As a FE developer, I want a generic error contract for wrong-channel logins, so that I don't leak which accounts are internal.
4. As an operator, I want to create the first Admin with `npm run cli -- create-admin --email --name`, so that no Admin is ever created through the public API.
5. As an operator, I want the CLI to prompt for the password (not take it from argv), so that it doesn't end up in shell history or process lists.
6. As an operator, I want the CLI to fail without overwriting when the email already exists, so that I can't accidentally hijack an account.
7. As an operator, I want the CLI to validate password strength like registration does, so that Admin passwords follow the same policy.
8. As an Admin, I want to list Staff accounts, so that I can see who has back-office access.
9. As an Admin, I want to create a Staff account with email, name and initial password, so that I can onboard employees.
10. As an Admin, I want creating Staff with an existing email to fail with 409, so that one email maps to one Account.
11. As an Admin, I want to rename a Staff account, so that I can fix typos.
12. As an Admin, I want to disable a Staff account, so that a leaving employee loses access.
13. As an Admin, I want disabling to kill every active session of that Staff immediately, so that I don't have to wait for token expiry.
14. As an Admin, I want to re-enable a disabled Staff, so that I can restore access after a mistake.
15. As an Admin, I want the staff endpoints never to touch Admin accounts, so that Admins can only be managed via CLI.
16. As a Staff, I want to receive 403 on `/admin/staff`, so that only Admins manage staff.
17. As a Staff, I want to receive 403 on customer-only routes, so that internal accounts cannot shop.
18. As a Customer, I want to receive 403 on `/admin/*`, so that back-office stays internal.
19. As a disabled Staff, I want login refused with a generic error, so that I can't sign back in.
20. As a visitor, I want registration with an internal account's email to return the same generic error as any taken email, so that internal emails are not enumerable.
21. As an Admin, I want every create/rename/disable/enable of Staff recorded with actor, target, action and time, so that I can audit back-office access changes.
22. As a disabled Staff holding a refresh token, I want refresh to fail with 401, so that disabling covers refresh flows too.

## Implementation Decisions

- **Login:** `POST /api/v1/auth/login` dùng chung cho mọi vai trò. Response và JWT có `role`. Login của user `disabled` → lỗi chung (không phân biệt với sai mật khẩu).
- **Phân quyền route:** `/admin/*` mặc định `@Roles('staff','admin')`. `/admin/staff` chỉ `@Roles('admin')`. Route mua hàng (cart, checkout khi có) dùng `@Roles('customer')`. Task này cần ít nhất một route customer-only có thật để kiểm chứng.
- **Staff API** (khớp `architecture/modules/identity.md` §4):
  - `GET /admin/staff`: danh sách có phân trang, chỉ role `staff`.
  - `POST /admin/staff` `{ email, name, password }` → 201. Email trùng → 409.
  - `PATCH /admin/staff/:id` `{ name }`.
  - `POST /admin/staff/:id/disable` và `/enable`. Hai lệnh này idempotent.
  - `:id` không phải Staff (vd. Admin, customer) → 404.
- **Vô hiệu hoá phiên:** disable tăng `session_version` và thu hồi refresh token. JWT strategy so `sessionVersion` của token với DB → lệch thì 401.
- **Register:** email đã tồn tại với bất kỳ vai trò nào → lỗi chung như hiện tại cho email trùng.
- **CLI:** module CLI độc lập (`nest-commander` hoặc `NestFactory.createApplicationContext`) tái dùng service tạo user và password policy. Mật khẩu nhập qua prompt ẩn. Email tồn tại → exit code ≠ 0 và không ghi gì.
- **Audit:** bảng `audit_logs` theo 11-database §4.1 (actor_id, action, entity_type, entity_id, metadata jsonb, created_at). Ghi cùng transaction với thao tác Staff. Action: `staff.create`, `staff.rename`, `staff.disable`, `staff.enable`. Task này chỉ ghi cho các thao tác Staff.

## Testing Decisions

- Test qua hành vi quan sát được từ bên ngoài: HTTP status/body và dòng DB có thể truy vấn được (audit). Không test chi tiết guard hay strategy nội bộ.
- Seam 1, **e2e HTTP** (`createTestApp` + supertest), file mới `admin-staff.e2e-spec.ts`. Ca chính: phân quyền 403 chéo vai trò. CRUD Staff. Disable khi đang đăng nhập → access token cũ 401 và refresh 401. Enable lại → đăng nhập được. Có audit row sau mỗi thao tác. Register với email nội bộ → lỗi chung.
- Seam 2, **CLI command**: gọi command handler trong application context test với prompt được stub. Assert Admin được tạo, email trùng → lỗi và không đổi dữ liệu. Không spawn process.
- Prior art: `test/auth-login.e2e-spec.ts`, `test/auth-refresh.e2e-spec.ts`, `test/auth-register.e2e-spec.ts`, `test/support/create-test-user.ts`.

## Out of Scope

Google login. Hồ sơ khách hàng. Tạo/sửa Admin qua API. Reset mật khẩu Staff do Admin thực hiện. Audit log cho các module khác. Phân quyền chi tiết hơn bốn vai trò. Các route cart/checkout thật.

## Further Notes

Tham chiếu: ADR 0005 · `business/02` §1, §4 · `architecture/modules/identity.md` §4 · `11-database` §4.1. Cơ chế `session_version` đã được đổi tên ở task 01.

## Acceptance criteria

- AC1: Login trả `role` cho cả ba vai trò.
- AC2: Staff gọi route `@Roles('customer')` → 403. Customer gọi `/admin/*` → 403. Staff gọi `/admin/staff` → 403.
- AC3: Disable Staff đang đăng nhập → request kế tiếp 401, refresh 401.
- AC4: `create-admin` tạo được Admin. Email trùng → lỗi, không ghi đè.
- AC5: Mỗi thao tác Staff có đúng một dòng `audit_logs`.
- AC6: lint, typecheck, test, test:e2e xanh.
