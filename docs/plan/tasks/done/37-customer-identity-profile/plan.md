---
status: done
---

# Plan 37: Định danh và hồ sơ Khách hàng

## Đã triển khai

- Nâng chính sách mật khẩu mạnh lên tối thiểu 15 ký tự.
- Thêm Google ID token login/link và chặn Staff/Admin khỏi storefront login.
- Thêm lockout sai mật khẩu theo cửa sổ 15 phút.
- Thêm hồ sơ Customer, locale giao diện/email và sổ địa chỉ.
- Thêm migration additive cho các trường mới.

## Kiểm chứng

- [x] Typecheck.
- [x] Unit suite.
- [x] OpenAPI generation.
- [ ] E2E migration/Google credential thật cần môi trường PostgreSQL và GOOGLE_CLIENT_ID.
