---
status: todo
pr:
blocked-by:
  - 17-access-admin-api
  - 28-cod-checkout
  - 33-staff-order-operations
  - 34-returns-refunds
---

# Đồng ý dữ liệu, vận hành và báo cáo

**What to build:** Admin có thể cấu hình vận hành và xuất dữ liệu kế toán; hệ thống lưu bằng chứng Consent và ghi nhận truy cập dữ liệu cá nhân theo phạm vi MVP đã xác định.

**Blocked by:** 17-access-admin-api, 28-cod-checkout, 33-staff-order-operations, 34-returns-refunds

**Status:** ready-for-agent

- [ ] Đăng ký và checkout thu Consent không tick sẵn; lưu riêng consent xử lý dữ liệu và email marketing kèm phiên bản chính sách, thời điểm và kênh.
- [ ] Cấu hình FallbackShippingFee, FreeShippingThreshold, CodLimit và ánh xạ phường/xã GHN chỉ bởi Admin.
- [ ] Mở chi tiết Khách hàng hoặc Đơn hàng và tra cứu số điện thoại tạo lịch sử truy cập; mở danh sách đơn không tạo log.
- [ ] Báo cáo Doanh thu chỉ tính đơn Hoàn tất, tách tiền hàng và Phí ship, trừ Hoàn tiền Đổi trả đúng quy tắc.
- [ ] Admin xuất danh sách đơn đã thu tiền theo ngày làm dữ liệu cho kế toán nhưng không tích hợp hoá đơn điện tử.
