---
status: todo
pr:
blocked-by:
  - 28-cod-checkout
---

# Thanh toán online và đối soát

**What to build:** Buyer có thể đặt đơn online qua VNPay hoặc MoMo, nhận xác nhận chỉ từ IPN/đối soát và có trạng thái tiền/đơn nhất quán khi hết hạn, trùng thông báo hoặc sai số tiền.

**Blocked by:** 28-cod-checkout

**Status:** ready-for-agent

- [ ] Đơn online tạo Giữ hàng 15 phút; link thanh toán hết hạn sau 10 phút và chỉ cho thử lại đến phút thứ 7.
- [ ] Cổng thanh toán và thử lại được đại diện qua các lần Thanh toán riêng; VNPay/MoMo dùng cùng hợp đồng gateway.
- [ ] IPN và đối soát xác nhận thanh toán thành công, không xác nhận theo Return URL.
- [ ] IPN trùng hoặc thông báo đã xử lý không ghi trùng; sai số tiền tạo Cờ và không tự nhận sai lệch.
- [ ] Thanh toán thành công chuyển Giữ hàng thành trừ Tồn kho và Hàng chờ xuất trong cùng giao dịch.
- [ ] Tiền về sau khi đơn hết hạn, đã huỷ hoặc đã xử lý tạo Hoàn tiền/Yêu cầu Hoàn tiền và Cờ theo quy tắc hợp lệ.
