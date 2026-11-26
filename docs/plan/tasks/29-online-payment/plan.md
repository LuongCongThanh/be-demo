# Kế hoạch triển khai — Thanh toán online và đối soát

## Trình tự

1. Thêm schema và migration cho Payment, Payment notification, inventory reservation, refund request, order flag và các index/constraint cần thiết; cập nhật Prisma Client.
2. Tạo `payment` module với hợp đồng `PaymentGateway`, adapter VNPay/MoMo, xác minh chữ ký, idempotent payment attempts và cấu hình optional fail-safe.
3. Mở rộng checkout: đặt đơn online từ quote còn hạn; khóa quote, biến thể, inventory và voucher theo thứ tự ổn định; tạo Order, Voucher usage, reservation và idempotency response atomic.
4. Thêm payment IPN endpoints, lưu inbox đã xác minh và áp dụng kết quả; xác nhận đơn, chuyển reservation và ghi Hàng chờ xuất trong transaction có khóa Order.
5. Thêm job đối soát định kỳ dùng cùng processor để xác nhận kết quả; serialize cuộc đua giữa giải phóng reservation hết hạn và hủy Order.
6. Thêm test cho chữ ký provider, idempotency request/attempt, cửa sổ tạo link, tính atomic Order–stock, IPN trùng, sai số tiền, thanh toán muộn/trùng và đối soát.
7. Trước PR chạy lint, typecheck, unit/e2e, build và review diff; chỉ ghi nhận sandbox UAT nếu đã chạy với merchant credentials hợp lệ.

## Rủi ro và bảo vệ

- Không gọi gateway trong transaction DB. Nếu tạo link timeout thì không tự sinh transaction reference mới; retry phải dùng lại cùng Payment attempt.
- Dữ liệu Return URL không bao giờ xác nhận giao dịch.
- Chỉ lưu IPN sau khi xác minh chữ ký; không đưa secret/credential vào payload lưu trữ.
- Khóa Order trước, sau đó cập nhật reservation, tồn kho và Payment trong transaction; gọi provider sau commit.
- Tiền là số nguyên VND. Với sai lệch hoặc khoản thu ngoài dự kiến, không đổi trạng thái Order; tạo yêu cầu hoàn gắn với Payment và cờ chưa xử lý.
