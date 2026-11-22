---
status: todo
pr:
blocked-by:
  - 29-online-payment
  - 33-staff-order-operations
---

# Hoàn hàng, Đổi trả và Hoàn tiền

**What to build:** Staff có thể xử lý hàng hoàn về, Đổi trả theo từng dòng và ghi nhận Hoàn tiền thủ công mà không vượt số tiền đã nhận hoặc nhập kho trùng.

**Blocked by:** 29-online-payment, 33-staff-order-operations

**Status:** ready-for-agent

- [ ] Chỉ tạo Đổi trả cho đơn Đã giao trong 7 ngày; dòng giảm giá trên 50% không được chọn.
- [ ] Chấp nhận/từ chối theo từng dòng, số lượng chấp nhận nằm trong số lượng gửi trả và lựa chọn nhập lại kho là bắt buộc.
- [ ] Chỉ phần được chấp nhận và chọn nhập lại mới cộng Tồn kho; hàng không chấp nhận gửi lại Buyer theo quy trình Staff.
- [ ] Tiền hoàn đề xuất dùng phần Buyer thực trả theo phân bổ Voucher và làm tròn lũy kế, không dùng Giá áp dụng hiện tại.
- [ ] Ghi nhận Hoàn tiền thủ công yêu cầu giao dịch và ngày hoàn; tổng Hoàn tiền cho một Thanh toán không vượt số thực nhận.
