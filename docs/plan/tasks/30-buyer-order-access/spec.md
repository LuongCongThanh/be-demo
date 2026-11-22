---
status: todo
pr:
blocked-by:
  - 26-buyer-cart
  - 28-cod-checkout
---

# Tra cứu và xem đơn Buyer

**What to build:** Khách vãng lai và Khách hàng có thể truy cập đúng đơn của mình theo cơ chế xác thực phù hợp mà không làm lộ dữ liệu đơn.

**Blocked by:** 28-cod-checkout

**Status:** ready-for-agent

- [ ] Ngay sau đặt, Khách vãng lai xem và thao tác đơn trong 30 phút mà không tra cứu lại.
- [ ] Sau cửa sổ vừa đặt, tra cứu đúng Mã đơn + số điện thoại mở phiên truy cập 30 phút; sai tổ hợp trả phản hồi không tiết lộ trường sai.
- [ ] Tra cứu sai giới hạn 10 lần mỗi IP trong 15 phút, sau đó áp dụng throttling.
- [ ] Với Customer đã đăng nhập, chỉ identity của chính họ mới đọc được lịch sử và chi tiết đơn của mình, theo bản chụp lúc đặt; thay đổi catalog không đổi bản ghi đã mua. Dùng identity prerequisite trong task 25 (stories 38–44) và Customer context của task 26, không triển khai lại đăng ký/đăng nhập trong lát cắt này.
- [ ] Chỉ gắn đơn Guest vào tài khoản sau khi email của tài khoản được xác thực và khớp email trên đơn; không gắn theo số điện thoại.
