# Plan 08: Tách `AuthService` theo use case

Branch: `refactor/identity-use-case-services`, tạo từ `dev` sau khi merge 07. Một PR; mỗi service nên là một commit (`refactor: extract SessionService from AuthService`…) để review từng phần.

Hướng dẫn: [guide.md](./guide.md). Kết quả: [report.md](./report.md).

## Phân chia (theo `auth.service.ts` hiện tại)

| Method (dòng hiện tại)                                                                                     | Đích                    | Inject                        |
| ---------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------- |
| `register` (67), `verifyEmail` (133), `claimEmailVerification`, `resendVerification` (213)                 | `RegistrationService`   | Prisma, Password, Token, Mail |
| `login` (231), `refreshToken` (277), `revokeAllSessionsAsReuseDetected`, `logout` (421), `logoutAll` (432) | `SessionService`        | Prisma, Password, Token, Jwt  |
| `forgotPassword` (344), `resetPassword` (364), `claimPasswordResetToken`, `applyPasswordReset`             | `PasswordResetService`  | Prisma, Password, Token, Mail |
| `getMe` (439), `getCustomerProfile` (454)                                                                  | `AccountProfileService` | Prisma                        |
| `sendBestEffort` (481)                                                                                     | helper nội bộ           | —                             |

Cột "Inject" chỉ là dự đoán; đọc code thật rồi bỏ những dependency không dùng.

| `describe` trong spec (dòng)                                   | Spec mới                          |
| -------------------------------------------------------------- | --------------------------------- |
| register (89), verifyEmail (219), resendVerification (369)     | `registration.service.spec.ts`    |
| login (419), refreshToken (509), logout (790), logoutAll (812) | `session.service.spec.ts`         |
| forgotPassword (660), resetPassword (697)                      | `password-reset.service.spec.ts`  |
| getMe (633)                                                    | `account-profile.service.spec.ts` |

## Các bước

1. [ ] Ghi metric "trước": số unit test, số dòng `auth.service.ts`/spec, Swagger.
2. [ ] Tách lần lượt từng service theo thứ tự ít rủi ro trước: account-profile → password-reset → registration → session. Sau mỗi service, chạy `test` + `test:e2e`.
3. [ ] Chuyển các khối `describe` tương ứng sang spec mới; thu gọn setup; giữ nguyên assertion.
4. [ ] Sửa `AuthController`/`MeController` và `providers` trong `IdentityModule`. Xoá `AuthService`.
5. [ ] Sửa import `MAX_VERIFY_ATTEMPTS` trong `test/auth-verify-email.e2e-spec.ts`.
6. [ ] Kiểm AC1–AC6; ghi metric "sau" (kể cả token: `npm run tokens -- <sessionId> --md`); chạy `/code-review` rồi `/ship`.
7. [ ] Sau khi merge: viết `report.md`, `status: done`.

## Rủi ro

- **Transaction** (`register`, `verifyEmail`, `applyPasswordReset`) dùng `prisma.$transaction`; phải chuyển nguyên khối, không tách ra giữa chừng.
- **Spec dùng chung fixture/mock** ở đầu file (dòng 1–88): copy phần cần dùng vào từng spec; chỉ tạo helper test chung khi ≥ 3 spec dùng giống hệt nhau.
- **Phụ thuộc chéo** (vd. reset password thu hồi phiên): gọi `TokenService` trực tiếp, không inject `SessionService`, để tránh hai service phụ thuộc vòng vào nhau.
