---
status: done
pr:
blocked-by: []
labels: [ready-for-agent]
---

# Spec 15: Schema RBAC và migration dữ liệu `ADMIN`/`STAFF`

Branch dự kiến: `feature/rbac-schema` · Slice A (RBAC) của tái cấu trúc ba repo. Không viết test mới (Phase 7); xác minh bằng typecheck, lint, build, Swagger và chạy tay. Test cũ chỉ sửa import/hằng số theo tên mới, không đổi ý nghĩa assertion.

## Problem Statement

Phân quyền dựa trên enum `Role { CUSTOMER STAFF ADMIN }` cố định trên `User`. Admin không cấu hình được quyền cho Staff.

## Solution

- `prisma/schema/identity.prisma`: chuyển `User`, `RefreshToken`, `PasswordResetToken`, `EmailVerificationToken` vào; thêm `Role` (tên duy nhất, cờ `isSystem`), `RolePermission` (roleId + permission), `UserRole` (userId + roleId). Enum liên quan identity chuyển vào file này.
- `src/common/auth/permission.enum.ts`: enum TypeScript thuần nhóm `CATALOG_*`, `OPERATIONS_*`, `ADMINISTRATION_*` (bao phủ mọi route back-office hiện có + quản lý Vai trò/Tài khoản nội bộ). `RolePermission.permission` lưu string, chỉ nhận giá trị enum ở tầng API.
- Phân biệt danh tính: `CUSTOMER` vẫn là loại tài khoản Khách hàng, không phải Vai trò. Giữ cột `role` cũ tới slice F nếu cần cho tương thích, hoặc thay bằng loại tài khoản — ghi quyết định trong report.
- Migration viết tay, forward-only: tạo bảng; seed Vai trò hệ thống `Admin` (mọi Quyền) và `Staff` (Quyền vận hành); gán `ADMIN` → `Admin`, `STAFF` → `Staff`; **RAISE EXCEPTION nếu có > 1 Admin active**; tăng `sessionVersion` (hoặc revoke refresh token) của mọi tài khoản nội bộ. `prisma/seed.ts` seed hai Vai trò hệ thống.
- `UserAuthProvider`, `GuestOrderSession` để tới slice cần chúng (đăng nhập mạng xã hội / slice C), không tạo bảng trống.

## Acceptance criteria

- Chạy thử migration trên Postgres local (docker) có dữ liệu seed + bản có 2 Admin active: bản thường thành công đúng một Admin, bản 2 Admin dừng có thông báo rõ. Ghi lệnh và kết quả trong report.
- `prisma migrate diff` của CI sạch; typecheck, lint, build pass; API cũ vẫn chạy (guard chưa đổi ở task này).
