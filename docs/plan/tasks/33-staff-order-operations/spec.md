---
status: todo
pr:
blocked-by:
  - 27-inventory-availability
  - 32-ghn-fulfillment
  - 17-access-admin-api
---

# Nghiệp vụ Staff xử lý đơn

**What to build:** Staff có thể điều hành danh sách Đơn hàng, xác nhận, đóng gói, bàn giao, xử lý Cờ và huỷ hoặc hoàn tất các tình huống giao hàng hợp lệ.

**Blocked by:** 27-inventory-availability, 32-ghn-fulfillment, 17-access-admin-api

**Status:** ready-for-agent

- [ ] Danh sách và chi tiết đơn cho phép lọc theo trạng thái và loại Cờ; quyền truy cập tuân RBAC.
- [ ] Staff xác nhận đơn và chuyển sang ĐANG ĐÓNG GÓI; mọi thao tác ghi audit with người thực hiện và giá trị trước/sau.
- [ ] Bàn giao theo quy trình GHN chỉ xoá Hàng chờ xuất sau khi Vận đơn tạo thành công.
- [ ] Staff huỷ đơn ở trạng thái vận hành được phép với lý do bắt buộc; huỷ vận đơn gặp sự cố xác nhận hàng chưa rời kho hay mất/hư.
- [ ] Đơn đã giao chuyển Hoàn tất sau 7 ngày chỉ khi không còn Đổi trả mở; thời điểm chốt ghi Doanh thu.
