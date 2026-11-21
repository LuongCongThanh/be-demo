Type: research
Status: resolved

## Question

Các hướng dẫn bảo mật hiện hành khuyến nghị gì cho độ dài/mức mạnh mật khẩu, throttling hoặc khóa tạm đăng nhập sai, và tra cứu đơn guest chống dò? Đưa ra baseline áp dụng được cho MVP, phân biệt best practice với yêu cầu pháp lý, ưu tiên nguồn chuẩn/chính thức và ghi ngày kiểm tra.

## Answer

Baseline nghiên cứu đề xuất: mật khẩu tối thiểu 15 ký tự cho tài khoản chỉ dùng mật khẩu; throttling theo account và IP; khóa tạm 15 phút; thông tin tra cứu guest có độ ngẫu nhiên mật mã, phản hồi đồng nhất và authorization theo đối tượng. Đây là khuyến nghị bảo mật, không phải kết luận về nghĩa vụ pháp lý. Xem nguồn và phân tích trong [báo cáo kiểm soát xác thực](https://github.com/LuongCongThanh/be-demo/blob/research/auth-abuse-control-guidance/research/auth-abuse-control-guidance.md).
