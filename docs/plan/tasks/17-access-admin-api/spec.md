---
status: done
pr: #83
blocked-by: [16-permissions-guard]
labels: [ready-for-agent]
---

# Spec 17: API quản lý Vai trò, Quyền và gán Vai trò

Branch dự kiến: `feature/access-admin-api` · Slice A (RBAC) của tái cấu trúc ba repo. Không viết test mới (Phase 7); xác minh bằng typecheck, lint, build, Swagger và chạy tay. Test cũ chỉ sửa import/hằng số theo tên mới, không đổi ý nghĩa assertion.

## Solution

- `modules/identity/access/`: `admin-role.controller.ts`, `access.service.ts`, `dto/`. `IdentityModule` export `AccessService`.
- API: liệt kê Quyền (enum, kèm nhóm); CRUD Vai trò (tên + danh sách Quyền); gán/bỏ Vai trò cho Tài khoản nội bộ (nhiều Vai trò mỗi tài khoản).
- Bất biến: Vai trò `Admin` read-only, luôn bằng toàn bộ enum; Vai trò hệ thống `Admin`, `Staff` không xoá được; đúng một Tài khoản Admin active — không vô hiệu hoá/xoá/gỡ Vai trò Admin của tài khoản đó.
- Đổi Quyền của Vai trò hoặc gán Vai trò → tăng `sessionVersion` của các tài khoản bị ảnh hưởng; mọi thay đổi ghi audit (`auditLog.record(tx, …)` trong cùng transaction).
- Sinh lại `docs/openapi/openapi.json` (nếu task 14 đã merge).

## Acceptance criteria

- Chạy tay: tạo Vai trò, tick Quyền, gán cho Staff → Staff đăng nhập lại có Quyền mới; refresh token cũ bị từ chối; sửa/xoá Vai trò `Admin` bị từ chối; gỡ Admin khỏi tài khoản Admin duy nhất bị từ chối; bản ghi audit có đủ.
