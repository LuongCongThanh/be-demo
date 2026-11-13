---
status: todo
pr:
blocked-by: [15-rbac-schema]
labels: [ready-for-agent]
---

# Spec 16: `PermissionsGuard`, `@Authorize(...Permission)` và `auth/me`

Branch dự kiến: `feature/permissions-guard` · Slice A (RBAC) của tái cấu trúc ba repo. Không viết test mới (Phase 7); xác minh bằng typecheck, lint, build, Swagger và chạy tay. Test cũ chỉ sửa import/hằng số theo tên mới, không đổi ý nghĩa assertion.

## Solution

- `@Authorize(...Permission)` thay `@Authorize(...Role)`; `roles.guard.ts` → `permissions.guard.ts`: cho qua khi tài khoản có **mọi** Quyền khai báo. Route chỉ cần đăng nhập (Khách hàng) giữ nguyên; ownership check giữ riêng. Xoá `roles.decorator.ts` nếu không còn dùng.
- Access token (~15 phút) mang `roles[]`, `permissions[]` (tính lúc login/refresh từ `UserRole` → `RolePermission`; Vai trò `Admin` = toàn bộ enum). Không đọc database mỗi request. Refresh token bị từ chối khi `sessionVersion` đổi.
- `GET /api/v1/auth/me` trả thêm `roles[]`, `permissions[]`; Swagger xuất enum `Permission`.
- Gán Quyền cho mọi route back-office hiện có (catalog, staff) theo bảng trong report.

## Acceptance criteria

- Chạy tay trên API local: Admin được phép; Staff bị 403 ở route quản trị; route khai báo 2 Quyền từ chối khi thiếu 1; Khách hàng không vào route back-office; đăng nhập Khách hàng không đổi.
- Không còn `Role.ADMIN`/`Role.STAFF` dùng để phân quyền ngoài bất biến Admin duy nhất.
