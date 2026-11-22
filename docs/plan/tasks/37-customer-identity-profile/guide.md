---
status: done
---

# Guide 37: Định danh và hồ sơ Khách hàng

## API chính

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/google`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET/PATCH /api/v1/me`
- `GET/POST/PATCH/DELETE /api/v1/me/addresses`

## Cấu hình

- `GOOGLE_CLIENT_ID` bắt buộc khi dùng Google login.
- `GOOGLE_TRANSLATE_API_KEY` không liên quan Task 37.

## Rollout

1. Apply migration `20261122190000_customer_profile_addresses`.
2. Generate Prisma client.
3. Cấu hình Google OAuth web client ID.
4. Chạy auth E2E trên DB migration đầy đủ.
