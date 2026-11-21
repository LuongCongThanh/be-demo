---
status: todo
pr:
blocked-by:
  - 28-cod-checkout
  - 29-online-payment
  - 32-ghn-fulfillment
  - 34-returns-refunds
---

# Thông báo Email theo vòng đời đơn

**What to build:** Buyer nhận Email giao dịch chính xác và theo ngôn ngữ ở mỗi cột mốc đặt đơn, thanh toán, vận chuyển, huỷ và hoàn tiền.

**Blocked by:** 28-cod-checkout, 29-online-payment, 32-ghn-fulfillment, 34-returns-refunds

**Status:** ready-for-agent

- [ ] Gửi email đặt đơn COD, thanh toán thành công, huỷ, đang giao, đã giao và khi Hoàn tiền được ghi nhận.
- [ ] Không gửi email đặt đơn hoặc huỷ cho đơn online chưa thanh toán.
- [ ] Ngôn ngữ email theo Khách hàng đã chọn hoặc locale lúc checkout; tên Sản phẩm trong email giữ tiếng Việt.
- [ ] Delivery qua outbox sau commit và consumer có thể chạy lại mà không gửi trùng.
- [ ] EmailLog retention và xử lý metadata PII tuân theo chính sách quyền riêng tư/lưu trữ dữ liệu đã được phê duyệt; không mặc định thời hạn cụ thể khi chưa xác nhận chính sách.
