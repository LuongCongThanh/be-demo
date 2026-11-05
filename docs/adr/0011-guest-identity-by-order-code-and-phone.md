# Khách vãng lai được nhận diện bằng Mã đơn + số điện thoại; đơn chỉ gắn vào Tài khoản qua email đã xác thực

Khách vãng lai không có Tài khoản. Giỏ gắn với cookie (30 ngày); sau khi đặt, Khách vãng lai thao tác với đơn trong 30 phút, sau đó phải tra cứu bằng **Mã đơn + số điện thoại** khớp nhau, mỗi lần tra cứu đúng mở quyền 30 phút (`business/02-actors-permissions.md` §2). Mã đơn ngẫu nhiên, không đoán được (BR-ORD-03); tra cứu sai bị giới hạn theo IP và luôn trả "Không tìm thấy đơn" (US-401).

Đơn vãng lai chỉ được gắn vào Tài khoản Khách hàng khi **email trùng và đã xác thực** (BR-ORD-08) — không bao giờ theo số điện thoại, vì số điện thoại không được xác thực.

Phương án bị loại: bắt buộc tạo tài khoản (giảm tỉ lệ chuyển đổi, trái US-301); magic link qua email (email là tuỳ chọn với Khách vãng lai); gắn theo số điện thoại (ai biết số người khác là chiếm được lịch sử đơn).

Hệ quả: `orders.user_id` và `carts.user_id` nullable; Order lưu thông tin liên hệ; quyền thao tác của Khách vãng lai là một phiên ngắn hạn gắn với một đơn, không phải một Tài khoản.
