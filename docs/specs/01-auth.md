---
status: Verified
owner: Backend
last_verified: 2026-09-23
dependencies: [CONTEXT.md, adr/0005-canonical-four-role-authorization-model.md]
supersedes: docs/superpowers/auth-playbook
verification:
  [src/auth, test/auth-register-flow.e2e-spec.ts, test/auth-login.e2e-spec.ts, test/auth-refresh.e2e-spec.ts]
---

# 01 — Auth module specification

## Scope

Register, verify/resend email, login, refresh rotation/reuse detection, logout/logout-all, forgot/reset password, current User, JWT authentication, RBAC and ownership guard foundation.

## Contract

- Base path: `/api/v1/auth`.
- Access token đi trong `Authorization: Bearer`.
- Refresh credential nằm trong HttpOnly cookie theo runtime configuration.
- Public endpoints không được tiết lộ email có tồn tại trong forgot/resend flows.
- Login yêu cầu User `ACTIVE` và Email Verification đã hoàn tất.
- Role canonical: `CUSTOMER`, `ORDER_STAFF`, `STORE_MANAGER`, `MASTER_ADMIN`.

## Invariants

- Password chỉ lưu dạng Argon2 hash.
- Verification/reset/refresh token không lưu plaintext.
- Refresh token được rotate; reuse làm thu hồi credential liên quan.
- Logout-all thu hồi mọi Session của User.
- JWT authorization version phải khớp User hiện tại.
- Hệ thống luôn phải giữ ít nhất một active, verified MASTER_ADMIN khi Users administration được triển khai.

## Authorization

Auth cung cấp `JwtAuthGuard`, `RolesGuard`, `OwnershipGuard` và decorators. Mỗi module business vẫn phải định nghĩa resource ownership và permission matrix của nó; generic guard không thay thế domain authorization.

## Integration gates

- Unit và E2E hiện hành phải pass.
- Real SMTP test là opt-in external integration gate, không phải mặc định của local suite.
- Trước cross-origin production client: review SameSite/Secure/CORS/CSRF threat model.
