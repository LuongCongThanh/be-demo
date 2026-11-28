Type: grilling
Status: resolved
Blocked by: 06

## Question

Dựa trên kết quả ticket 06, chốt ngưỡng cụ thể và hành vi throttling cho đăng nhập, mật khẩu và tra cứu đơn guest. Bảo đảm thông báo không tiết lộ tài khoản/đơn có tồn tại, đồng thời hạn chế việc kẻ khác gây khóa tài khoản hoặc làm gián đoạn khách hợp lệ.

## Answer

- **Đăng nhập:** khóa tạm tài khoản 15 phút sau 5 lần nhập sai trong cửa sổ 15 phút; áp dụng throttling riêng theo IP để chống tấn công phân tán. Tài khoản chưa tồn tại không tạo lock; chỉ áp dụng IP throttling và luôn trả cùng một lỗi chung cho sai mật khẩu hoặc email chưa tồn tại.
- **Khôi phục khỏi khóa:** không khóa vĩnh viễn; reset bộ đếm sau 15 phút không có lần sai. Nếu 3 chu kỳ khóa xảy ra trong 24 giờ, gửi cảnh báo chung đến chủ tài khoản mà không làm tăng độ trễ hoặc thay đổi kết quả đăng nhập.
- **Tra cứu đơn guest:** giới hạn 10 lần tra cứu sai trên mỗi IP trong 15 phút, sau đó áp dụng rate limit 15 phút. Mọi tổ hợp mã đơn/số điện thoại sai trả cùng "Không tìm thấy đơn" và không phân biệt trường nào sai.
- **Mật khẩu và quên mật khẩu:** giữ tối thiểu 15 ký tự; quên mật khẩu luôn trả thông báo chung cho mọi email, giới hạn 5 yêu cầu trên mỗi tài khoản hoặc IP trong 15 phút, và đặt lại mật khẩu thành công thu hồi mọi phiên hiện có.
