---
status: done
---

# Plan 17: API quản lý Vai trò, Quyền và Admin duy nhất

## Phạm vi đã triển khai

1. API RBAC, CRUD Vai trò, gán/gỡ Vai trò và bất biến hệ thống.
2. Đóng guard tạo Admin: khoá dòng Vai trò `Admin`, kiểm tra Admin active trong transaction.
3. Audit và thu hồi phiên khi thay đổi Vai trò/Quyền.
4. Kiểm chứng unit và E2E cho CLI và API.

## Chuỗi thực hiện

- [x] Bổ sung guard tạo tài khoản trong `InternalAccountService.create`.
- [x] Bổ sung test unit từ chối Admin thứ hai.
- [x] Bổ sung E2E CLI: tạo Admin, trùng email, tạo song song, mật khẩu, tham số.
- [x] Chạy unit/E2E/E2E RBAC liên quan.
- [x] Cập nhật spec, bảng tổng hợp và report.

## Rủi ro

- DB E2E phải được migrate đầy đủ trước khi chạy toàn bộ suite RBAC/category.
- Một số assertion chạy tay manual cần môi trường throwaway độc lập.
