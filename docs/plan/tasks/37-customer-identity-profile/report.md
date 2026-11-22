---
status: done
pr:
---

# Report 37

## Đã làm

- Hồ sơ và địa chỉ giao hàng thuộc `IdentityModule`.
- Locale `vi|en` cho giao diện và email.
- Google ID token verification bằng `google-auth-library`.
- Lockout sai mật khẩu 5 lần/15 phút.
- Chính sách mật khẩu 15 ký tự áp dụng registration/reset/CLI.
- Migration additive bảo toàn dữ liệu hiện có.

## Kiểm chứng

- `npm run typecheck`: pass.
- `npm run test`: 304/304 pass.
- `npm run openapi:write`: pass.
- `npm run lint`: pass với warning existing no-explicit-any.

## Chưa nghiệm thu

- Google credential thật.
- Migration trên DB người dùng.
- E2E HTTP toàn bộ profile/address/Google.
