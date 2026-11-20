# Module `identity`

> Trạng thái: **Đã chốt cho MVP** ([quy ước](../../README.md#trạng-thái-tài-liệu)). Bảng: [`../11-database.md`](../11-database.md). Ranh giới: [`../02-modules.md`](../02-modules.md). Nguồn nghiệp vụ: [business/02](../../business/02-actors-permissions.md), [business/03](../../business/03-user-stories.md) E5, US-1001. Bảo mật: [../05-auth-security.md](../05-auth-security.md).

> **Phân biệt thiết kế mục tiêu và hiện trạng:** §§1–9 dưới đây ghi thiết kế mục tiêu/kế hoạch; chúng không khẳng định các luồng đã được triển khai. Kiểm kê mã hiện tại, các khác biệt và giới hạn phạm vi nằm ở §10.

## 1. Trách nhiệm (thiết kế mục tiêu)

- Sở hữu: Tài khoản (Khách hàng, Staff, Admin), vai trò và phân quyền, xác thực/đăng nhập, phiên (refresh token, `session_version`), token xác thực email và đặt lại mật khẩu.
- Không sở hữu: hồ sơ Khách hàng và sổ địa chỉ. Module `customer` trong tương lai sở hữu hồ sơ Khách hàng và quản lý địa chỉ; hiện chưa triển khai module này hay quản lý địa chỉ.
- Quy tắc: mỗi email thuộc **một** Tài khoản (không phân biệt hoa thường); Tài khoản nội bộ có đúng một vai trò `staff` hoặc `admin` và không dùng được storefront: một endpoint `/auth/login` chung trả `role`, FE từ chối sai kênh, server chặn mua hàng bằng `@Roles` ([ADR 0005](../../adr/0005-four-actor-authorization-model.md)).
- Không sở hữu: đơn của Khách vãng lai (`ordering` gắn `user_id` theo luồng email xác thực mục tiêu), audit log (`admin-config`).

## 2. Mô hình (thiết kế mục tiêu)

Chi tiết cột, ràng buộc, enum: [`../11-database.md` §4.1](../11-database.md#41-identity).

- `users` — Tài khoản Khách hàng/Staff/Admin
- `user_auth_providers` — liên kết đăng nhập Google
- `refresh_tokens` — phiên đăng nhập, xoay vòng
- `password_reset_tokens`, `email_verification_tokens` — token một lần cho đặt lại mật khẩu, xác minh email
- `guest_order_sessions` — phiên 30 phút của Khách vãng lai với một đơn

Hồ sơ Khách hàng và địa chỉ thuộc module `customer` trong tương lai; `identity` không sở hữu `customer_addresses`.
`audit_logs` thuộc `admin-config`; `identity` ghi vào qua service.

## 3. Interface cho module khác (thiết kế mục tiêu)

| Hàm                                                                               | Dùng bởi                                |
| --------------------------------------------------------------------------------- | --------------------------------------- |
| `getActor(request)` → `{ kind: guest                                              | customer                                | staff | admin, userId?, guestOrderId? }` | Guard của mọi module |
| `findVerifiedUserByEmail(email)`                                                  | `ordering` (gắn đơn lúc đặt, BR-ORD-08) |
| `issueGuestOrderSession(orderId, tx)` / `verifyGuestOrderSession(token, orderId)` | `ordering`                              |
| `getLocale(userId)`                                                               | `notifications`                         |

Các interface trong bảng là hợp đồng mục tiêu, không phải toàn bộ API hiện có; xem §10 để biết hiện trạng.

## 4. API (thiết kế mục tiêu)

| Method     | Path                                                                                   | Actor           | Ghi chú                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| `POST`     | `/auth/register`                                                                       | guest           | US-501; gửi email xác thực                                                                                |
| `POST`     | `/auth/verify-email` · `/auth/resend-verification`                                     | guest, customer |                                                                                                           |
| `POST`     | `/auth/login` · `/auth/google` · `/auth/refresh` · `/auth/logout`                      | —               | US-502; login chung mọi vai trò, trả `role`; `/auth/google` từ chối email Tài khoản nội bộ bằng lỗi chung |
| `POST`     | `/auth/forgot-password` · `/auth/reset-password`                                       | guest           | US-503; luôn trả cùng một phản hồi                                                                        |
| `GET/POST` | `/admin/staff` · `PATCH /admin/staff/:id` · `POST /admin/staff/:id/disable`, `/enable` | admin           | US-1001; không tạo được `admin`                                                                           |

Hồ sơ Customer (`/me`) và `/me/addresses` là trách nhiệm mục tiêu của module `customer` trong tương lai, không phải API mục tiêu của `identity`.

## 5. Luồng mục tiêu (chưa đồng nghĩa đã triển khai)

### 5.1. Đăng ký và xác thực email (mục tiêu)

Tạo `users` (`customer`, chưa xác thực) → token xác thực → outbox `identity.email-verification-requested`. Xác thực xong → `email_verified_at`, outbox `identity.email-verified` (consumer: `ordering` gắn đơn vãng lai cùng email, BR-ORD-08).

### 5.2. Đăng nhập Google (mục tiêu)

Email Google đã xác thực: có Tài khoản Khách hàng cùng email → liên kết và coi email là đã xác thực (phát `identity.email-verified` nếu trước đó chưa); email thuộc Tài khoản nội bộ → từ chối bằng lỗi chung; chưa có → tạo Tài khoản.

### 5.3. Vô hiệu hoá Staff (mục tiêu)

Trong một transaction: `status=disabled`, `session_version += 1`, thu hồi mọi refresh token, ghi audit. Guard so `session_version` trong access token với giá trị hiện tại ở mỗi request ([05-auth-security](../05-auth-security.md) §5) → phiên cũ mất hiệu lực ngay (US-1001 AC1). Đổi/đặt lại mật khẩu cũng tăng `session_version`.

### 5.3b. Vai trò, Quyền và gán Vai trò (`identity/access/`) (mục tiêu)

`AccessService` (export từ `IdentityModule`): liệt kê Quyền theo nhóm, CRUD Vai trò, gán/gỡ Vai trò cho Tài khoản nội bộ (`/admin/permissions`, `/admin/roles`, `/admin/internal-accounts/:accountId/roles/:roleId`). Gán/gỡ Vai trò, đổi Quyền hoặc tên Vai trò đang được gán: một transaction gồm thay đổi + `session_version += 1` + thu hồi refresh token của mọi tài khoản bị ảnh hưởng + audit (`/auth/refresh` không so `session_version`, nên phải thu hồi token).

Bất biến: Vai trò `Admin` read-only (luôn bằng toàn bộ enum), chỉ một tài khoản giữ, không xoá được; Vai trò hệ thống (`Admin`, `Staff`) không xoá, không đổi tên; Admin active duy nhất không bị vô hiệu hoá hay gỡ Vai trò `Admin`. Xoá Vai trò còn đang được gán bị từ chối (409), không cascade.

### 5.4. Tạo Admin bằng CLI (mục tiêu)

```bash
npm run cli -- create-admin --email admin@example.com
```

- Entrypoint riêng `src/cli.ts` dùng **nest-commander**, khởi tạo Nest application context (không mở HTTP server). Lệnh **không** có endpoint HTTP tương ứng (US-1001 AC3).
- Hỏi mật khẩu qua prompt ẩn (hoặc đọc từ biến môi trường khi chạy trong CI/ops), kiểm tra email chưa thuộc Tài khoản nào (US-1001 AC2), tạo `users` với `role=admin`, `email_verified_at=now`, ghi `audit_logs` với `actor_user_id = null` (hệ thống — schema không có actor `cli`), `action = 'admin.create'`.
- Chạy được trong container production bằng `node dist/cli.js create-admin`.

## 6. Sự kiện mục tiêu

| Phát                                                                                                    | Nghe |
| ------------------------------------------------------------------------------------------------------- | ---- |
| `identity.email-verification-requested`, `identity.password-reset-requested`, `identity.email-verified` | —    |

## 7. Job mục tiêu

| Job               | Tần suất | Hành vi                                                                |
| ----------------- | -------- | ---------------------------------------------------------------------- |
| Dọn token hết hạn | Mỗi ngày | Xoá refresh/reset/verification token và `guest_order_sessions` quá hạn |

## 8. Bao phủ mục tiêu

US-501–506, US-1001; business/02 §1–2, §4; ADR 0005, ADR 0011.

## 9. Câu hỏi mở của thiết kế mục tiêu

- Thời hạn access token và refresh token cụ thể (đề xuất 15 phút / 30 ngày) — chưa có trong business.

## 10. Hiện trạng triển khai (as-built)

### 10.1. Ranh giới và hành vi hiện tại

- `src/modules/identity/**` hiện thực tài khoản, đăng nhập/xác thực, khôi phục mật khẩu, hồ sơ tài khoản đọc, quản lý Staff và RBAC cho tài khoản nội bộ. Tài khoản Khách hàng vẫn là loại tài khoản trong identity; đây không phải module Customer.
- Hiện có `POST /auth/register`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/login`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/logout`, `/auth/logout-all`, `GET /auth/me`; storefront `GET /me` chỉ đọc hồ sơ Customer. Prefix triển khai cấu hình trong ứng dụng là `/api/v1`.
- Quản lý Staff hiện có `GET /admin/staff`, `GET /admin/staff/:id`, `POST /admin/staff`, `PATCH /admin/staff/:id`, `POST /admin/staff/:id/disable` và `/enable`. Quản lý quyền/vai trò hiện có `/admin/permissions`, CRUD `/admin/roles` và `PUT`/`DELETE /admin/internal-accounts/:accountId/roles/:roleId` để gán/gỡ vai trò.
- Đăng ký tạo tài khoản Customer chưa xác minh và mã email 6 chữ số; xác thực email giới hạn 5 lần thử sai cho mỗi mã, hết hạn sau 10 phút. Gửi email là best-effort sau khi ghi dữ liệu. Đăng nhập cần mật khẩu hợp lệ, tài khoản đang hoạt động và email đã xác minh; access JWT mang các claim vai trò/quyền và `sessionVersion`. Refresh token được xoay vòng, lưu hash; phát hiện dùng lại sẽ thu hồi các refresh token còn hoạt động. Đặt lại mật khẩu thu hồi refresh token.
- Customer hiện có `GET /me` chỉ trả `id`, `email`, `fullName`, `phone`; không có cập nhật hồ sơ. Không có module Customer hay API quản lý địa chỉ trong mã identity đã kiểm tra.
- Các luồng Google OAuth/liên kết provider, outbox và sự kiện email trong §§5–6, phiên khách vãng lai, job dọn token và API hồ sơ/địa chỉ Customer là thiết kế mục tiêu, không được hiện thực trong các file identity hiện tại. Các endpoint `/auth/google`, `PATCH /me` và `/me/addresses` không có trong controller hiện tại. Việc tạo Admin bằng CLI không phải endpoint HTTP; tích hợp CLI nằm ngoài phạm vi file identity của kiểm kê này.
- Thời hạn access token hiện mặc định `15m`, refresh token `7d` (có thể cấu hình); mã xác thực email `10 phút`, password reset `1 giờ`. Vì vậy đề xuất `30 ngày` trong §9 là mục tiêu/chưa đồng nhất với mặc định triển khai.

### 10.2. Kiểm kê file triển khai

Các bảng dưới đây liệt kê toàn bộ **38 file TypeScript không phải test** trong `src/modules/identity/**`; file `*.spec.ts` không thuộc kiểm kê triển khai. Đường dẫn trong bảng tính từ `src/modules/identity/`. “Symbol công khai” nêu các class/type/DTO được export (hoặc controller endpoint); dependency chỉ liệt kê phụ thuộc đáng kể.

#### Module, authentication và profile

| File                                                  | Trách nhiệm hiện tại · symbol công khai                                                                                                             | Dependency đáng kể                                                                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `identity.module.ts`                                  | Lắp ghép `IdentityModule`; đăng ký controllers/providers và export `AccessService`, `InternalAccountService`, `PassportModule`.                     | Nest Config/JWT/Passport; `MailModule`, `AuditModule`; toàn bộ controller/service identity.                                                                              |
| `auth/controllers/storefront/auth.controller.ts`      | `AuthController`: các endpoint register/verify/resend, login/refresh, forgot/reset, auth-me, logout/logout-all; đặt/xoá refresh cookie HttpOnly.    | `RegistrationService`, `SessionService`, `PasswordResetService`, `AccountProfileService`; `EmailThrottlerGuard`; Config, security decorators/current user, DTO, Swagger. |
| `auth/controllers/storefront/me.controller.ts`        | `MeController`: `GET /me` CUSTOMER-only, trả hồ sơ hiện có; không có PATCH/address routes.                                                          | `AccountProfileService`, `AuthorizeAccountType`, `CurrentUser`, `CustomerProfileResponseDto`.                                                                            |
| `auth/services/storefront/registration.service.ts`    | `RegistrationService`, `MAX_VERIFY_ATTEMPTS`, `GENERIC_RESEND_MESSAGE`: tạo Customer, xác minh/resend code email với claim một lần và giới hạn thử. | `PrismaService`, `PasswordService`, `TokenService`, `MailService`, `sendBestEffort`; Register/Verify/Resend DTOs.                                                        |
| `auth/services/storefront/session.service.ts`         | `SessionService`, `LoginResult`, `RefreshTokenResult`: login, JWT/refresh token rotation, reuse detection, logout cá nhân/toàn bộ.                  | Prisma, `PasswordService`, `TokenService`, `JwtService`, `AccessClaimsService`; `LoginDto`.                                                                              |
| `auth/services/storefront/password-reset.service.ts`  | `PasswordResetService`, `GENERIC_FORGOT_PASSWORD_MESSAGE`: yêu cầu reset phản hồi chung; claim token, đổi mật khẩu và thu hồi phiên.                | Prisma, `PasswordService`, `TokenService`, `MailService`, `sendBestEffort`; Forgot/Reset DTOs.                                                                           |
| `auth/services/storefront/account-profile.service.ts` | `AccountProfileService`: ánh xạ allow-list cho `GET /auth/me` và đọc hồ sơ Customer cho `GET /me`.                                                  | `PrismaService`, `JwtPayload` roles/permissions, `MeResponseDto`, `CustomerProfileResponseDto`.                                                                          |
| `auth/services/shared/access-claims.service.ts`       | `AccessClaimsService`, `AccessClaims`, `ADMIN_ROLE_NAME`: tính roles/permissions cho token; Customer nhận mảng rỗng, Admin nhận tập quyền enum.     | Prisma role assignments; `Permission` và `ADMIN_ROLE_PERMISSIONS`.                                                                                                       |
| `auth/services/shared/password.service.ts`            | `PasswordService`: hash/verify mật khẩu.                                                                                                            | `argon2`.                                                                                                                                                                |
| `auth/services/shared/token.service.ts`               | `TokenService`: sinh/hash mã xác minh, token reset và refresh; chỉ lưu hash, áp dụng TTL.                                                           | Node crypto, Prisma, Config và `ms`.                                                                                                                                     |
| `auth/strategies/jwt.strategy.ts`                     | `JwtStrategy`: xác thực Bearer JWT, từ chối user không còn tồn tại, sai `sessionVersion` hoặc sai account type.                                     | Passport JWT, Config, Prisma, `JwtPayload`.                                                                                                                              |
| `auth/guards/email-throttler.guard.ts`                | `EmailThrottlerGuard`: giới hạn in-memory theo route và email/IP; dùng cho resend và forgot-password.                                               | Nest `CanActivate`/HTTP exception; không dùng throttler store dùng chung.                                                                                                |
| `auth/utils/send-best-effort.ts`                      | `sendBestEffort`: bắt lỗi gửi email và log, không làm request nghiệp vụ thất bại.                                                                   | Kiểu `Logger` của Nest.                                                                                                                                                  |

#### DTO authentication

| File                                                   | Trách nhiệm hiện tại · symbol công khai                                                                   | Dependency đáng kể                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `auth/dto/storefront/register.dto.ts`                  | `RegisterDto`: validate email, mật khẩu mạnh, tên và điện thoại.                                          | Swagger, `class-validator`, `IsStrongPassword`.       |
| `auth/dto/storefront/register-response.dto.ts`         | `RegisterResponseDto`: response tạo account chỉ gồm id/email.                                             | Swagger.                                              |
| `auth/dto/storefront/login.dto.ts`                     | `LoginDto`: email và password đầu vào.                                                                    | Swagger, `class-validator`.                           |
| `auth/dto/storefront/login-response.dto.ts`            | `LoginResponseDto`: access token và user response; không trả refresh token trong body.                    | Swagger, `AuthUserResponseDto`.                       |
| `auth/dto/storefront/auth-user-response.dto.ts`        | `AuthUserResponseDto`, `MeResponseDto`: dữ liệu account đăng nhập; auth-me thêm roles/permissions từ JWT. | Swagger; Prisma `AccountType`; security `Permission`. |
| `auth/dto/storefront/customer-profile-response.dto.ts` | `CustomerProfileResponseDto`: allow-list hồ sơ Customer đọc được hiện tại.                                | Swagger.                                              |
| `auth/dto/storefront/verify-email.dto.ts`              | `VerifyEmailDto`: email và code 6 chữ số.                                                                 | Swagger, `class-validator`.                           |
| `auth/dto/storefront/resend-verification.dto.ts`       | `ResendVerificationDto`: email xin gửi lại mã.                                                            | Swagger, `class-validator`.                           |
| `auth/dto/storefront/forgot-password.dto.ts`           | `ForgotPasswordDto`: email yêu cầu reset.                                                                 | Swagger, `class-validator`.                           |
| `auth/dto/storefront/reset-password.dto.ts`            | `ResetPasswordDto`: token, password mạnh và xác nhận khớp.                                                | Swagger, `class-validator`, `IsStrongPassword`.       |
| `auth/dto/storefront/message-response.dto.ts`          | `MessageResponseDto`: response thông điệp dùng chung.                                                     | Swagger.                                              |
| `auth/dto/storefront/refresh-response.dto.ts`          | `RefreshResponseDto`: access token; refresh token mới đi qua cookie.                                      | Swagger.                                              |

#### Tài khoản nội bộ và phân quyền

| File                                                           | Trách nhiệm hiện tại · symbol công khai                                                                                                                                                                                                                                                                                                                                         | Dependency đáng kể                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `internal-account/controllers/admin/admin-staff.controller.ts` | `AdminStaffController`: list/detail/create/rename/disable/enable Staff, được bảo vệ bằng permission.                                                                                                                                                                                                                                                                            | `InternalAccountService`, permission decorator/enum, pagination, Staff DTOs, Swagger.     |
| `internal-account/services/admin/internal-account.service.ts`  | `InternalAccountService`, `CreateInternalAccountInput`, `EMAIL_IN_USE_MESSAGE`: tạo tài khoản nội bộ và quản lý Staff; transaction audit, session invalidation khi disable, bảo vệ Admin duy nhất.                                                                                                                                                                              | Prisma, `PasswordService`, `AuditLogService`, `AccessService`, pagination, Staff DTOs.    |
| `internal-account/dto/admin/create-staff.dto.ts`               | `CreateStaffDto`: email, tên và mật khẩu ban đầu hợp lệ.                                                                                                                                                                                                                                                                                                                        | Swagger, `class-transformer`, `class-validator`, `IsStrongPassword`.                      |
| `internal-account/dto/admin/update-staff.dto.ts`               | `UpdateStaffDto`: tên Staff đã trim/validate.                                                                                                                                                                                                                                                                                                                                   | Swagger, `class-transformer`, `class-validator`.                                          |
| `internal-account/dto/admin/staff-response.dto.ts`             | `StaffResponseDto`: thông tin Staff, trạng thái và vai trò.                                                                                                                                                                                                                                                                                                                     | Swagger, Prisma `UserStatus`, `RoleSummaryResponseDto`.                                   |
| `internal-account/dto/admin/paginated-staff-response.dto.ts`   | `PaginatedStaffResponseDto`: danh sách Staff phân trang.                                                                                                                                                                                                                                                                                                                        | Swagger, `PaginationMetaDto`, `StaffResponseDto`.                                         |
| `access/controllers/admin/admin-role.controller.ts`            | `AdminRoleController`: liệt kê permissions, CRUD roles, xem/gán/gỡ roles tài khoản nội bộ.                                                                                                                                                                                                                                                                                      | `AccessService`, permission/current-user security, pagination, role DTOs, Swagger.        |
| `access/services/admin/access.service.ts`                      | `AccessService`; lỗi export `ROLE_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `ROLE_NAME_IN_USE`, `ADMIN_ROLE_READ_ONLY`, `SYSTEM_ROLE_NOT_RENAMEABLE`, `SYSTEM_ROLE_NOT_DELETABLE`, `ADMIN_ROLE_ALREADY_ASSIGNED`, `SOLE_ADMIN_KEEPS_ROLE`, `SOLE_ADMIN_NOT_DISABLED`: RBAC CRUD, kiểm tra bất biến Admin/system roles, audit và kết thúc phiên trong transaction khi quyền hiệu lực đổi. | Prisma, `AuditLogService`, permission enum, pagination, `AccessClaimsService`, role DTOs. |
| `access/dto/admin/create-role.dto.ts`                          | `CreateRoleDto`: tên/mô tả/quyền của role mới; loại bỏ trùng quyền và validate enum.                                                                                                                                                                                                                                                                                            | Swagger, `class-transformer`, `class-validator`, `Permission`.                            |
| `access/dto/admin/update-role.dto.ts`                          | `UpdateRoleDto`: các trường cập nhật tùy chọn của role.                                                                                                                                                                                                                                                                                                                         | Swagger `PartialType`, `CreateRoleDto`.                                                   |
| `access/dto/admin/role-response.dto.ts`                        | `RoleResponseDto`, `PaginatedRoleResponseDto`: role, quyền, số tài khoản và metadata phân trang.                                                                                                                                                                                                                                                                                | Swagger, `Permission`, `PaginationMetaDto`.                                               |
| `access/dto/admin/permission-group-response.dto.ts`            | `PermissionGroupResponseDto`: nhóm permission theo prefix.                                                                                                                                                                                                                                                                                                                      | Swagger, `Permission`.                                                                    |
| `access/dto/admin/account-roles-response.dto.ts`               | `RoleSummaryResponseDto`, `AccountRolesResponseDto`: vai trò được gán cho một tài khoản.                                                                                                                                                                                                                                                                                        | Swagger.                                                                                  |

### 10.3. Kiểm kê test

Liệt kê các unit spec trong identity, E2E quản trị identity, E2E storefront auth và E2E CLI create-admin theo phạm vi yêu cầu. Mỗi mô tả nêu trọng tâm được kiểm tra trong file.

#### Unit specs

| File                                                                                    | Mục đích                                                                                                                                  |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/identity/auth/guards/email-throttler.guard.spec.ts`                        | Giới hạn theo email và route, trả 429 khi vượt ngưỡng, fallback theo IP nếu thiếu email.                                                  |
| `src/modules/identity/auth/services/shared/password.service.spec.ts`                    | Hash mật khẩu với salt và xác minh đúng/sai mật khẩu.                                                                                     |
| `src/modules/identity/auth/services/shared/token.service.spec.ts`                       | Sinh và lưu hash token email/reset/refresh; xóa token cũ, transaction khi tạo verification token và TTL cấu hình.                         |
| `src/modules/identity/auth/services/storefront/account-profile.service.spec.ts`         | Ánh xạ `GET /auth/me` sang allow-list, không lộ `passwordHash`.                                                                           |
| `src/modules/identity/auth/services/storefront/password-reset.service.spec.ts`          | Phản hồi chung forgot-password; reset token hợp lệ/hết hạn/đã dùng, race claim, đổi password và thu hồi mọi refresh token.                |
| `src/modules/identity/auth/services/storefront/registration.service.spec.ts`            | Đăng ký/duplicate email, transaction và gửi email best-effort; xác minh code, giới hạn lần thử, replay/race và resend với phản hồi chung. |
| `src/modules/identity/auth/services/storefront/session.service.spec.ts`                 | Login và lỗi thông tin xác thực/trạng thái; refresh rotation, reuse/race; logout một phiên hoặc mọi phiên.                                |
| `src/modules/identity/auth/strategies/jwt.strategy.spec.ts`                             | Chấp nhận `sessionVersion` hiện hành và từ chối version cũ hoặc user không tồn tại.                                                       |
| `src/modules/identity/internal-account/services/admin/internal-account.service.spec.ts` | Tạo tài khoản nội bộ/audit/duplicate email; quản lý Staff, phân trang, rename, disable/enable và vô hiệu phiên.                           |

#### E2E quản trị identity

| File                                          | Mục đích                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/admin/identity/admin-staff.e2e-spec.ts` | Phân quyền ADMIN/STAFF/CUSTOMER; tạo, liệt kê, rename, disable/enable Staff; kiểm tra audit, đăng nhập, email trùng và chính sách mật khẩu. |
| `test/admin/identity/roles.e2e-spec.ts`       | Phân tách bốn actor, chặn STAFF khỏi thao tác catalog dành cho ADMIN, xác nhận Admin qua role guard và từ chối JWT payload legacy.          |

#### E2E storefront auth

| File                                                        | Mục đích                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `test/storefront/auth/auth-forgot-password.e2e-spec.ts`     | Phản hồi chung cho email tồn tại/không tồn tại, token reset chỉ còn một token hợp lệ và validate email.                              |
| `test/storefront/auth/auth-login.e2e-spec.ts`               | Login thành công và refresh cookie; lỗi 401 không phân biệt email/sai mật khẩu; chặn account disabled/chưa verify và validate input. |
| `test/storefront/auth/auth-logout.e2e-spec.ts`              | Yêu cầu access token; logout thu hồi đúng session, logout-all thu hồi mọi session của user mà không ảnh hưởng user khác.             |
| `test/storefront/auth/auth-me.e2e-spec.ts`                  | Bảo vệ `GET /auth/me` khi thiếu/sai token và chỉ trả dữ liệu user allow-list khi hợp lệ.                                             |
| `test/storefront/auth/auth-rate-limiting.e2e-spec.ts`       | Hạn mức login theo IP, forgot-password theo email và giới hạn global cho route mặc định.                                             |
| `test/storefront/auth/auth-refresh.e2e-spec.ts`             | Cookie refresh bắt buộc, token hết hạn/reuse, xoay token và xử lý hai request đồng thời.                                             |
| `test/storefront/auth/auth-register.e2e-spec.ts`            | Tạo account và response allow-list; email trùng, input/mật khẩu sai và field ngoài schema.                                           |
| `test/storefront/auth/auth-register-flow.e2e-spec.ts`       | Luồng đăng ký đến xác minh mã email, cùng các lỗi email trùng, input sai và code sai.                                                |
| `test/storefront/auth/auth-resend-verification.e2e-spec.ts` | Cấp lại token cho account chưa verify; phản hồi chung cho email không tồn tại/đã verify và validate email.                           |
| `test/storefront/auth/auth-reset-password.e2e-spec.ts`      | Reset password, thu hồi session và login bằng mật khẩu mới; token invalid/replay/expired, xác nhận/mật khẩu yếu và race.             |
| `test/storefront/auth/auth-verify-email.e2e-spec.ts`        | Xác minh email; lỗi email/code, replay/expiry/format, khóa sau số lần đoán tối đa và race.                                           |

#### E2E CLI

| File                                       | Mục đích                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `test/system/cli-create-admin.e2e-spec.ts` | Tạo Admin từ CLI và audit; từ chối email đã dùng, mật khẩu yếu/xác nhận lệch và thiếu tham số bắt buộc. |

### 10.4. Khoảng trống phạm vi

- Không có Customer module hoặc implementation quản lý địa chỉ trong `src/modules/identity/**`; việc tạo module Customer, sở hữu hồ sơ/địa chỉ và triển khai các route tương ứng vẫn là công việc tương lai.
- Google OAuth, outbox/sự kiện nghiệp vụ, phiên guest và job dọn token chỉ có trong thiết kế mục tiêu ở tài liệu này; các file identity được kiểm kê không triển khai chúng.
- Kiểm kê test chỉ gồm các file được liệt kê ở §10.3; không đánh giá schema/migration, triển khai CLI hay các module khác. Các test dùng chung về mail/health/metrics và test catalog không được lặp lại ở đây.
