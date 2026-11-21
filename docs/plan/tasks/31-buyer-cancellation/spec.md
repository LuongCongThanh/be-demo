---
status: todo
pr:
blocked-by:
  - 28-cod-checkout
  - 29-online-payment
---

# Huỷ đơn Buyer và hoàn nghĩa vụ

**What to build:** Buyer có thể huỷ đơn hợp lệ trước Đang đóng gói, đồng thời hoàn tồn kho, trả lượt Voucher và tạo nghĩa vụ hoàn tiền online đúng cách.

**Blocked by:** 28-cod-checkout, 29-online-payment

**Status:** ready-for-agent

- [ ] Chỉ cho huỷ trước trạng thái ĐANG ĐÓNG GÓI; huỷ thanh công chỉ khi chuyển trạng thái hợp lệ.
- [ ] Huỷ đơn COD huỷ khoản thu COD, hoàn Hàng chờ xuất về Tồn kho và trả lượt Voucher còn hiệu lực.
- [ ] Huỷ đơn online đã thanh toán tạo yêu cầu Hoàn tiền toàn bộ Tổng tiền đơn và thông báo Buyer về nghĩa vụ hoàn.
- [ ] Huỷ đơn PENDING_PAYMENT giải phóng Giữ hàng và trả lượt Voucher mà không gửi email đặt đơn thành công.
- [ ] Thanh toán và hết hạn chạy cạnh tranh vẫn có đúng một kết quả; tiền về muộn đi nhánh Hoàn tiền thay vì ghi đè huỷ.
