---
decision_status: accepted
implementation_status: partial
decided_at: 2026-09-17
last_verified: 2026-09-23
related_spec: ../specs/04-users.md
---

# Dùng bốn role nghiệp vụ chuẩn (canonical)

Việc phân quyền sẽ dùng `CUSTOMER`, `ORDER_STAFF`, `STORE_MANAGER`, và `MASTER_ADMIN`; nhãn `ADMIN` cũ sẽ được migrate sang `MASTER_ADMIN` trước khi lên production. Mỗi route liệt kê tường minh toàn bộ role được chấp nhận thay vì dựa vào một cây phân cấp (hierarchy) ngầm, giữ nguyên tắc least-privilege và giúp ma trận quyền có thể review được; chỉ MASTER_ADMIN mới quản lý user, account status, và gán role, và hệ thống phải ngăn việc xóa bỏ MASTER_ADMIN đang hoạt động, đã xác thực cuối cùng.

Đã implement role migration và explicit route-role checks. Chưa implement Users administration và invariant bảo vệ active verified MASTER_ADMIN cuối cùng.
