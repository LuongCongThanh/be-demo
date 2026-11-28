---
status: todo
pr:
blocked-by:
  - 28-cod-checkout
  - 37-customer-identity-profile
---

# Tra cứu và xem đơn Buyer

**What to build:** Khách vãng lai và Khách hàng có thể truy cập đúng đơn của mình theo cơ chế xác thực phù hợp mà không làm lộ dữ liệu đơn.

**Blocked by:** 28-cod-checkout, 37-customer-identity-profile

- [ ] Ngay sau đặt, Khách vãng lai xem và thao tác đơn trong 30 phút mà không tra cứu lại.
- [ ] Sau cửa sổ vừa đặt, tra cứu đúng Mã đơn + số điện thoại mở phiên truy cập 30 phút; sai tổ hợp trả phản hồi không tiết lộ trường sai.
- [ ] Tra cứu sai giới hạn 10 lần mỗi IP trong 15 phút, sau đó áp dụng throttling.
- [ ] Khách hàng xem lịch sử đơn và chi tiết Dòng đơn theo bản chụp lúc đặt; thay đổi catalog không đổi bản ghi đã mua.
- [ ] Việc gắn đơn Guest vào tài khoản chỉ theo email đã xác thực, không gắn theo số điện thoại.
- [ ] Khi email được xác thực qua email hoặc Google login, gắn các Guest Order đủ điều kiện có cùng email vào tài khoản; không liên kết theo số điện thoại. Không làm sống lại hoặc đổi chủ Order đã gắn với một tài khoản khác (story 39, BR-ORD-08).
