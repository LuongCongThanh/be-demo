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
- [ ] Theo chính sách đã chốt tại [business/06-compliance.md mục 5](../../../business/06-compliance.md) và [architecture/07 mục 3.2](../../../architecture/07-async-events-jobs.md), sau 90 ngày kể từ trạng thái cuối phải đặt `recipient` và `amount` của EmailLog thành `null` nhưng giữ bản ghi để thống kê; xoá outbox event `done` sau 90 ngày. Thời hạn này chỉ áp dụng cho EmailLog/outbox, không quyết định thời hạn lưu `raw_payload`, `creation_input` hay địa chỉ đơn hàng đang chờ xác minh trước go-live.
