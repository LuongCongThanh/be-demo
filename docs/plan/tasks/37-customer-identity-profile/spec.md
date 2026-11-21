---
status: todo
pr:
blocked-by:
  - 08-identity-use-case-services
  - 16-permissions-guard
---

# Định danh và hồ sơ Khách hàng

**What to build:** Khách hàng có thể đăng ký, xác minh và đăng nhập an toàn, quản lý hồ sơ/sổ địa chỉ và chọn ngôn ngữ; module Customer sở hữu hồ sơ và địa chỉ, còn Identity sở hữu tài khoản và xác thực.

**Blocked by:** 08-identity-use-case-services, 16-permissions-guard

**Status:** ready-for-agent

**Story ownership:** Stories 38, 40–44 của task 25 thuộc task này. Task này sở hữu Google login và tín hiệu xác minh identity trong story 39; task 30 sở hữu việc gắn Guest Order theo email đã xác thực. Task 26 phụ thuộc task này để gộp Giỏ hàng vào tài khoản.

- [ ] Đăng ký bằng email yêu cầu mật khẩu tối thiểu 15 ký tự; mã xác minh email dùng một lần và hết hạn sau 10 phút. Mọi phản hồi đăng ký hợp lệ không tiết lộ email đã có tài khoản hay chưa.
- [ ] Đăng nhập email và Google hỗ trợ tạo tài khoản Customer mới hoặc liên kết Google với tài khoản Customer đủ điều kiện cùng email đã xác thực; email không tồn tại và sai mật khẩu nhận cùng lỗi chung. Không cho Staff/Admin dùng storefront login và lỗi không tiết lộ tài khoản nội bộ.
- [ ] Đăng nhập sai 5 lần trong 15 phút khoá tài khoản 15 phút; giới hạn theo IP áp dụng riêng. Email chưa tồn tại không bị khoá tài khoản, nhưng vẫn chịu throttling IP. Đặt lại bộ đếm sau 15 phút không có lần sai; sau 3 chu kỳ khoá trong 24 giờ gửi cảnh báo chung, không làm thay đổi kết quả đăng nhập ([ngưỡng đã chốt](../../wayfinding/fashion-store-mvp-implementation/issues/11-auth-and-order-lookup-thresholds.md)).
- [ ] Quên mật khẩu luôn trả phản hồi chung, giới hạn 5 yêu cầu mỗi tài khoản hoặc IP trong 15 phút; token đặt lại chỉ dùng một lần, hết hạn sau 1 giờ, và đặt lại thành công vô hiệu hoá mọi phiên cũ.
- [ ] Customer được đọc/cập nhật hồ sơ cho phép như tên và số điện thoại, nhưng không sửa email trực tiếp; tài khoản chỉ xem/sửa dữ liệu của chính mình.
- [ ] Customer được thêm, sửa, xoá địa chỉ giao hàng và chọn một địa chỉ mặc định; địa chỉ tuân theo mô hình tỉnh/thành–phường/xã hiện hành.
- [ ] Customer chọn `vi` hoặc `en` riêng cho giao diện và email; locale email được cung cấp cho task 35, còn tên Sản phẩm vẫn tiếng Việt.
- [ ] Xác minh email/Google phát tín hiệu identity đã xác thực để task 30 có thể gắn Guest Order theo email; không gắn theo số điện thoại. Việc liên kết Order không nằm trong task này.
