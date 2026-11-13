---
status: done
pr: #85
blocked-by: [17-access-admin-api]
labels: [ready-for-agent]
---

# Spec 18: Chi tiết Tài khoản nội bộ kèm Vai trò

Branch dự kiến: `feature/staff-detail-roles` · Slice A (RBAC) của tái cấu trúc ba repo. Không viết test mới (Phase 7); xác minh bằng typecheck, lint, build, Swagger và chạy tay. Test cũ chỉ sửa fixture/tham số mong đợi theo hình dạng mới, không đổi ý nghĩa assertion.

## Problem Statement

CMS cần trang sửa Tài khoản nội bộ có URL riêng (mở trực tiếp, tải lại được) và cột Vai trò trong danh sách. API chỉ có `GET /admin/staff` (danh sách) và `GET /admin/internal-accounts/:id/roles`; không lấy được một tài khoản theo id, và danh sách không kèm Vai trò nên CMS phải gọi thêm một request mỗi dòng.

## Solution

- `GET /admin/staff/:id` (`ADMINISTRATION_INTERNAL_ACCOUNT_VIEW`): trả một Staff, 404 nếu id không phải Staff (cùng quy tắc lọc `role: STAFF` như các route khác).
- `StaffResponseDto` thêm `roles: RoleSummaryResponseDto[]` (id, tên, `isSystem`), sắp theo tên. Mọi route `admin/staff` (list, detail, create, rename, disable, enable) đều trả field này.
- Sinh lại `docs/openapi/openapi.json`; phát hành tag `openapi-v0.2.0` sau khi merge.

## Acceptance criteria

- Chạy tay: `GET /admin/staff/:id` của Staff → 200 kèm `roles: [Staff]`; id của Admin → 404; Staff không có `ADMINISTRATION_INTERNAL_ACCOUNT_VIEW` → 403; gán thêm Vai trò rồi gọi lại → `roles` có cả hai, sắp theo tên; `GET /admin/staff` có `roles` trên từng dòng.
