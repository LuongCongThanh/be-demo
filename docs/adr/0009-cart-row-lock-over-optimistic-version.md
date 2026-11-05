# Dùng row lock cho Giỏ hàng khi checkout, không dùng cột version

Checkout và các thao tác sửa Giỏ hàng chạy đồng thời được phối hợp bằng `SELECT ... FOR UPDATE` trên dòng `carts` lúc bắt đầu checkout, không dùng cột `carts.version` kiểu optimistic. Giỏ có đúng một chủ: một Tài khoản Khách hàng, hoặc một cookie Khách vãng lai (BR-CRT-01). Tranh chấp chỉ đến từ cùng một người (nhiều tab, gộp giỏ khi đăng nhập — BR-CRT-03), hiếm và ngắn, nên row lock đơn giản hơn việc kiểm tra-và-tăng version ở mọi thao tác.

Gộp giỏ khi đăng nhập cũng khoá cả hai giỏ theo thứ tự `id` tăng dần để tránh deadlock.

Phương án bị loại: optimistic version — hợp khi nhiều actor cùng sửa một bản ghi, không phải giỏ cá nhân.
