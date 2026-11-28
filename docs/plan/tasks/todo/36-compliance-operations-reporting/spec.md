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

**What to build:** Admin có thể cấu hình vận hành và xuất dữ liệu kế toán, trong khi hệ thống ghi Consent, xử lý ErasureRequest và truy cập dữ liệu cá nhân theo quy tắc hợp lệ.

**Blocked by:** 17-access-admin-api, 28-cod-checkout, 33-staff-order-operations, 34-returns-refunds

- [ ] Đăng ký và checkout thu Consent không tick sẵn; lưu riêng consent xử lý dữ liệu và email marketing kèm phiên bản chính sách, thời điểm và kênh.
- [ ] Cấu hình FallbackShippingFee, FreeShippingThreshold, CodLimit và ánh xạ phường/xã GHN chỉ bởi Admin.
- [ ] Yêu cầu xoá dữ liệu chỉ bắt đầu khi mọi đơn liên quan đã chót và không còn Hoàn tiền chờ; hoàn tất chỉ khi tất cả bước bắt buộc thành công.
- [ ] Đơn Khách vãng lai chưa gắn Tài khoản không dùng yêu cầu xoá trong tài khoản; Staff có thể lập yêu cầu riêng qua kênh hỗ trợ với số điện thoại và mã đơn, xác minh người yêu cầu trước khi xử lý, rồi chỉ ẩn danh khi mọi đơn liên quan đã ở trạng thái cuối và không còn Hoàn tiền chờ (US-1101 AC1, AC4–5; CMP-05).
- [ ] Mở chi tiết Khách hàng hoặc Đơn hàng và tra cứu số điện thoại tạo lịch sử truy cập; mở danh sách đơn không tạo log.
- [ ] Báo cáo Doanh thu chỉ tính đơn Hoàn tất, tách tiền hàng và Phí ship, trừ Hoàn tiền Đổi trả đúng quy tắc.
- [ ] Admin xuất danh sách đơn đã thu tiền theo ngày làm dữ liệu cho kế toán nhưng không tích hợp hoá đơn điện tử.
- [ ] Khi Buyer yêu cầu thông tin xuất hoá đơn, lưu ảnh chụp tùy chọn `invoice_info` theo Order gồm tên công ty, mã số thuế (MST), địa chỉ và email nhận hoá đơn; xuất các trường này cùng payment/order reference và thời điểm, số tiền đã thu trong danh sách kế toán. Order không yêu cầu hoá đơn để trống các trường; đây chỉ là dữ liệu hỗ trợ quy trình thủ công, không phát hành hoặc tích hợp hoá đơn điện tử.
