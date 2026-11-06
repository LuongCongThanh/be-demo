# Module `identity`

> Trạng thái: **Bản nháp cho tái cấu trúc** ([quy ước](../../README.md#trạng-thái-tài-liệu)). Bảng: [`../11-database.md`](../11-database.md). Ranh giới: [`../02-modules.md`](../02-modules.md). Nguồn nghiệp vụ: [business/02](../../business/02-actors-permissions.md), [business/03](../../business/03-user-stories.md) E5, US-1001. Bảo mật: [../05-auth-security.md](../05-auth-security.md).

## 1. Trách nhiệm

- Sở hữu: Tài khoản (Khách hàng, Staff, Admin), vai trò, liên kết Google, sổ địa chỉ, phiên (refresh token, `session_version`), token xác thực email và đặt lại mật khẩu, phiên truy cập đơn của Khách vãng lai.
- Quy tắc: mỗi email thuộc **một** Tài khoản (không phân biệt hoa thường); Tài khoản nội bộ có đúng một vai trò `staff` hoặc `admin` và không dùng được storefront: một endpoint `/auth/login` chung trả `role`, FE từ chối sai kênh, server chặn mua hàng bằng `@Roles` ([ADR 0005](../../adr/0005-four-actor-authorization-model.md)).
- Không sở hữu: đơn của Khách vãng lai (`ordering` gắn `user_id` khi nghe `identity.email-verified`), audit log (`admin-config`).

## 2. Mô hình

Chi tiết cột, ràng buộc, enum: [`../11-database.md` §4.1](../11-database.md#41-identity).

- `users` — Tài khoản Khách hàng/Staff/Admin
- `user_auth_providers` — liên kết đăng nhập Google
- `customer_addresses` — sổ địa chỉ 2 cấp của Khách hàng
- `refresh_tokens` — phiên đăng nhập, xoay vòng
- `password_reset_tokens`, `email_verification_tokens` — token một lần cho đặt lại mật khẩu, xác minh email
- `guest_order_sessions` — phiên 30 phút của Khách vãng lai với một đơn

`audit_logs` thuộc `admin-config`; `identity` ghi vào qua service.

## 3. Interface cho module khác

| Hàm                                                                               | Dùng bởi                                |
| --------------------------------------------------------------------------------- | --------------------------------------- |
| `getActor(request)` → `{ kind: guest                                              | customer                                | staff | admin, userId?, guestOrderId? }` | Guard của mọi module |
| `findVerifiedUserByEmail(email)`                                                  | `ordering` (gắn đơn lúc đặt, BR-ORD-08) |
| `issueGuestOrderSession(orderId, tx)` / `verifyGuestOrderSession(token, orderId)` | `ordering`                              |
| `getLocale(userId)`                                                               | `notifications`                         |

## 4. API

| Method                  | Path                                                                                   | Actor           | Ghi chú                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| `POST`                  | `/auth/register`                                                                       | guest           | US-501; gửi email xác thực                                                                                |
| `POST`                  | `/auth/verify-email` · `/auth/resend-verification`                                     | guest, customer |                                                                                                           |
| `POST`                  | `/auth/login` · `/auth/google` · `/auth/refresh` · `/auth/logout`                      | —               | US-502; login chung mọi vai trò, trả `role`; `/auth/google` từ chối email Tài khoản nội bộ bằng lỗi chung |
| `POST`                  | `/auth/forgot-password` · `/auth/reset-password`                                       | guest           | US-503; luôn trả cùng một phản hồi                                                                        |
| `GET/PATCH`             | `/me`                                                                                  | customer        | Hồ sơ, ngôn ngữ (US-505, US-506)                                                                          |
| `GET/POST/PATCH/DELETE` | `/me/addresses`                                                                        | customer        | US-504                                                                                                    |
| `GET/POST`              | `/admin/staff` · `PATCH /admin/staff/:id` · `POST /admin/staff/:id/disable`, `/enable` | admin           | US-1001; không tạo được `admin`                                                                           |

## 5. Luồng

### 5.1. Đăng ký và xác thực email

Tạo `users` (`customer`, chưa xác thực) → token xác thực → outbox `identity.email-verification-requested`. Xác thực xong → `email_verified_at`, outbox `identity.email-verified` (consumer: `ordering` gắn đơn vãng lai cùng email, BR-ORD-08).

### 5.2. Đăng nhập Google

Email Google đã xác thực: có Tài khoản Khách hàng cùng email → liên kết và coi email là đã xác thực (phát `identity.email-verified` nếu trước đó chưa); email thuộc Tài khoản nội bộ → từ chối bằng lỗi chung; chưa có → tạo Tài khoản.

### 5.3. Vô hiệu hoá Staff

Trong một transaction: `status=disabled`, `session_version += 1`, thu hồi mọi refresh token, ghi audit. Guard so `session_version` trong access token với giá trị hiện tại ở mỗi request ([05-auth-security](../05-auth-security.md) §5) → phiên cũ mất hiệu lực ngay (US-1001 AC1). Đổi/đặt lại mật khẩu cũng tăng `session_version`.

### 5.4. Tạo Admin bằng CLI

```bash
npm run cli -- create-admin --email admin@example.com
```

- Entrypoint riêng `src/cli.ts` dùng **nest-commander**, khởi tạo Nest application context (không mở HTTP server). Lệnh **không** có endpoint HTTP tương ứng (US-1001 AC3).
- Hỏi mật khẩu qua prompt ẩn (hoặc đọc từ biến môi trường khi chạy trong CI/ops), kiểm tra email chưa thuộc Tài khoản nào (US-1001 AC2), tạo `users` với `role=admin`, `email_verified_at=now`, ghi `audit_logs` với `actor_user_id = null` (hệ thống — schema không có actor `cli`), `action = 'admin.create'`.
- Chạy được trong container production bằng `node dist/cli.js create-admin`.

## 6. Sự kiện

| Phát                                                                                                    | Nghe |
| ------------------------------------------------------------------------------------------------------- | ---- |
| `identity.email-verification-requested`, `identity.password-reset-requested`, `identity.email-verified` | —    |

## 7. Job

| Job               | Tần suất | Hành vi                                                                |
| ----------------- | -------- | ---------------------------------------------------------------------- |
| Dọn token hết hạn | Mỗi ngày | Xoá refresh/reset/verification token và `guest_order_sessions` quá hạn |

## 8. Bao phủ

US-501–506, US-1001; business/02 §1–2, §4; ADR 0005, ADR 0011.

## 9. Câu hỏi mở

- Thời hạn access token và refresh token cụ thể (đề xuất 15 phút / 30 ngày) — chưa có trong business.
