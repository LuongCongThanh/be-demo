---
status: todo
pr:
blocked-by: [07-legacy-modules-layout]
---

# Spec 08: Tách `AuthService` theo use case

Branch: `refactor/identity-use-case-services` · Nguồn: [architecture review 2026-11-06, đề xuất #2](../../../architecture/reviews/architecture-review-2026-11-06.html)

## Problem Statement

`AuthService` dài 488 dòng và gánh bốn việc khác nhau: đăng ký và xác thực email, phiên đăng nhập, quên mật khẩu, hồ sơ. Spec của nó dài 823 dòng. Muốn sửa luật phiên thì phải đọc qua cả luật đăng ký, và mỗi test phải dựng đủ năm dependency, kể cả khi use case đó không dùng tới.

## Solution

Tách thành bốn service trong `modules/identity/services/auth/`. Mỗi service ứng với một use case và chỉ inject những gì use case đó cần. Controller gọi đúng service. Route, response và hành vi giữ nguyên.

## User Stories

1. As a developer changing session rules (refresh rotation, reuse detection), I want them in one session service, so that I don't read registration code.
2. As a developer changing registration/verify-email rules, I want one registration service, so that all BR around email verification is local.
3. As a developer changing password reset, I want one password-reset service, so that token claim + session revocation are in one place.
4. As a test author, I want each spec to set up only the dependencies its use case uses, so that tests are short and failures point at one use case.
5. As a reviewer, I want existing assertions to pass unchanged after being split across specs, so that I trust behavior did not change.
6. As a FE developer, I want routes, Swagger and responses unchanged.

## Implementation Decisions

1. Bốn service:
   - `RegistrationService`: register, verifyEmail, resendVerification, cùng hằng số liên quan (`MAX_VERIFY_ATTEMPTS`…).
   - `SessionService`: login, refreshToken, logout, logoutAll, phát hiện refresh token bị dùng lại.
   - `PasswordResetService`: forgotPassword, resetPassword.
   - `AccountProfileService`: getMe, getCustomerProfile.
2. `AuthService` bị xoá; không giữ facade.
3. `sendBestEffort` (gửi mail mà không làm hỏng request) trở thành một helper nội bộ của module, dùng chung cho registration và password-reset.
4. `PasswordService` và `TokenService` giữ nguyên; đây là các module sâu dùng chung.
5. `AuthController` inject ba service (registration, session, password-reset); `MeController` inject `AccountProfileService` (và `SessionService` nếu cần cho logout-all).
6. `IdentityModule` không đổi `exports`.

## Testing Decisions

- Test hành vi qua interface public của từng service, không test hàm private.
- `auth.service.spec.ts` được tách theo các khối `describe` sẵn có: register/verifyEmail/resendVerification → registration; login/refreshToken/logout/logoutAll → session; forgotPassword/resetPassword → password-reset; getMe → account-profile. **Không sửa assertion**, chỉ đổi phần setup.
- Có thể thêm test cho `getCustomerProfile` nếu trước đây chưa có, nhưng ghi riêng vào report.
- Kế thừa từ task 06/07: e2e không sửa assertion, Swagger `jq -S` diff rỗng.

## Acceptance Criteria

- [ ] AC1: `services/auth/auth.service.ts` và `auth.service.spec.ts` không còn tồn tại; có 4 service mới, mỗi service kèm spec.
- [ ] AC2: Không service nào inject dependency mà nó không dùng (kiểm bằng `lint` + đọc constructor).
- [ ] AC3: Tổng số unit test ≥ trước. Các test cũ pass mà không sửa assertion.
- [ ] AC4: `lint`, `typecheck`, `test`, `test:e2e` xanh; e2e chỉ được đổi đường import (`MAX_VERIFY_ATTEMPTS`).
- [ ] AC5: Swagger `jq -S` diff rỗng.
- [ ] AC6: Không file service nào trong `services/auth/` dài quá 250 dòng.

## Out of scope

`@Authorize` (#3), đổi logic hoặc luật nghiệp vụ, đổi DTO.
