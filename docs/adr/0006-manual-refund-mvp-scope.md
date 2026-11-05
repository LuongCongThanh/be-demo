# Hoàn tiền MVP: ghi nhận thủ công, yêu cầu Hoàn tiền tự tạo cho khoản thu sai

MVP không gọi API hoàn tiền của Cổng. Staff hoàn tiền trên trang quản trị VNPay/MoMo (hoặc chuyển khoản cho đơn COD Đổi trả) rồi ghi nhận "Đã hoàn tiền" kèm mã giao dịch hoàn (BR-REF-03, BR-REF-04). Mỗi Hoàn tiền gắn với đúng một Thanh toán đã nhận tiền và trả về đúng Cổng đó (BR-REF-01).

Hệ thống **tự tạo yêu cầu Hoàn tiền** và gắn Cờ cần xử lý — không tự hoàn — khi: số tiền thu khác Tổng tiền đơn (BR-PAY-04), hoặc tiền về cho đơn không còn chờ thanh toán (đã huỷ, đã được trả ở tab khác — BR-PAY-05). Đơn giữ nguyên trạng thái; không thêm trạng thái Order cho "còn tiền cần hoàn".

Số tiền: huỷ/Hoàn hàng đơn online hoàn toàn bộ, kể cả Phí ship (BR-REF-05); Đổi trả hoàn **một phần** theo số lượng được chấp nhận trừ Voucher đã phân bổ (BR-RET-07). Một thao tác chỉ tạo một yêu cầu cho mỗi Thanh toán; tổng hoàn không vượt số thực nhận (BR-REF-06). Thử lại thanh toán không giới hạn số lần trong cửa sổ link 10 phút (BR-INV-05).

Phương án bị loại: hoàn tiền tự động qua API Cổng — lùi sang Giai đoạn 2 vì rủi ro tiền thật khi chưa có test với sandbox; chỉ hoàn toàn phần — không đáp ứng Đổi trả.

Hệ quả: bảng `refunds` có trạng thái `REQUESTED → REFUNDED`, ràng buộc tổng theo Thanh toán ở tầng service trong transaction có khoá dòng Thanh toán.
