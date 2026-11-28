# Report 08: Tách `AuthService` theo use case

Trạng thái: **done** · PR #76.

## Đã làm

- Tách `AuthService` thành `RegistrationService`, `SessionService`, `PasswordResetService`, `AccountProfileService` trong `services/auth/`; xoá `AuthService` và spec cũ, không giữ facade.
- `sendBestEffort` thành hàm thuần `send-best-effort.ts` nhận `logger`.
- `auth.service.spec.ts` chia thành bốn spec theo `describe`; các dòng `expect` không đổi (96 dòng, so bằng multiset). Setup chỉ còn mock cần dùng.
- `AuthController` inject cả bốn service, `MeController` chỉ inject `AccountProfileService`; `IdentityModule` đổi `providers`, `exports` giữ nguyên.
- Hằng số và interface đi theo service dùng chúng: `MAX_VERIFY_ATTEMPTS`, `GENERIC_RESEND_MESSAGE` ở registration; `GENERIC_FORGOT_PASSWORD_MESSAGE` ở password-reset; `LoginResult`, `RefreshTokenResult` ở session. E2E chỉ đổi import `MAX_VERIFY_ATTEMPTS`.

## Kết quả

Chi tiết: [metric.md](./metric.md). Lint, typecheck, build, 240 unit test, 175 e2e test xanh; Swagger `jq -S` diff rỗng.

## Quyết định lệch kế hoạch

- Branch tên `chore/identity-use-case-services` thay vì `refactor/...`: hook pre-push chỉ cho `feature|fix|chore|docs|hotfix`.
- Logger context của `RegistrationService` và `PasswordResetService` đổi theo tên class (chỉ ảnh hưởng log). `SessionService` không còn logger vì không dùng.
- `AccountProfileService` không có spec riêng cho `getCustomerProfile`; không thêm test mới theo quy tắc dựng lại. Spec của nó chỉ chứa khối `getMe`.
- Sửa ví dụ layout trong `docs/convention/coding-style-conventions.md`.

## Bài học

- Cắt nguyên khối bằng script giữ được transaction và comment nguyên vẹn; typecheck bắt ngay mock bị thiếu khi thu gọn harness.
