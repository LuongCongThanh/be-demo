---
status: todo
pr:
blocked-by:
  - 17-access-admin-api
  - 24-category-content
  - 37-customer-identity-profile
---

# Giỏ hàng Buyer và gộp giỏ

**What to build:** Người mua có thể giữ một Giỏ hàng trên storefront, thêm/sửa/xoá đúng Biến thể size × màu, nhận giá hiện tại và gộp Giỏ hàng vãng lai vào tài khoản sau đăng nhập.

**Blocked by:** 17-access-admin-api, 24-category-content, 37-customer-identity-profile

**Status:** ready-for-agent

- [ ] Guest nhận Giỏ hàng gắn phiên ổn định, hết hạn sau 30 ngày không hoạt động.
- [ ] Thêm, sửa và xoá Biến thể giữ số lượng hợp lệ từ 1 đến 10 cho mỗi dòng; giỏ không trừ hoặc giữ Tồn kho.
- [ ] Giỏ hiển thị Giá áp dụng hiện tại và báo rõ khi giá thay đổi sau lần thêm trước.
- [ ] Đăng nhập gộp hai giỏ theo Khách hàng; cộng dòng trùng, kẹp số lượng mỗi Biến thể theo `min(tổng, Số lượng bán được, 10)` (BR-CRT-03, BR-CRT-05), báo các dòng bị kẹp và đóng giỏ vãng lai.
- [ ] Cung cấp kịch bản HTTP end-to-end có thể tự xác minh cho Guest và Customer.
