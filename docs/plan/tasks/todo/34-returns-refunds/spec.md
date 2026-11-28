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

- [ ] Chỉ tạo Đổi trả cho đơn Đã giao trong 7 ngày; dòng giảm giá trên 50% không được chọn. Đơn chưa giao, quá hạn hoặc không còn dòng đủ điều kiện bị từ chối, không tạo yêu cầu rỗng.
- [ ] Yêu cầu Đổi trả có vòng đời riêng `recorded → received → accepted | rejected`, không đổi trạng thái Order; không bỏ qua bước nhận hàng hoặc chuyển trạng thái ngược.
- [ ] Khi nhận hàng hoàn, ghi nhận việc nhận về riêng; sau đó Staff quyết định theo từng dòng: số lượng chấp nhận không vượt số lượng gửi trả và phải chọn nhập lại Tồn kho hoặc không nhập lại (hàng lỗi/hư).
- [ ] Nhánh chấp nhận một phần chỉ nhập kho số lượng được chấp nhận có chọn nhập lại; phần từ chối không nhập kho và phải được gửi lại Buyer theo quy trình Staff, chi phí do Buyer chịu.
- [ ] Nếu không có dòng nào được chấp nhận, yêu cầu kết thúc ở Từ chối, không tạo Hoàn tiền. Nếu có dòng được chấp nhận, tiền hoàn đề xuất dùng phần Buyer thực trả sau phân bổ Voucher, làm tròn lũy kế và không dùng Giá áp dụng hiện tại.
- [ ] Nếu số hoàn sau phân bổ/làm tròn bằng 0, vẫn xử lý quyết định nhập kho nhưng không tạo Hoàn tiền 0đ; nếu lớn hơn 0, yêu cầu vẫn đang mở cho tới khi Staff ghi nhận Hoàn tiền.
- [ ] Ghi nhận Hoàn tiền thủ công yêu cầu giao dịch và ngày hoàn; tổng Hoàn tiền cho một Thanh toán không vượt số thực nhận. Ghi nhận trùng không tạo thêm movement hoặc Hoàn tiền.
