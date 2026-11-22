---
status: todo
pr:
blocked-by:
  - 24-category-content
---

# Giỏ hàng Buyer và gộp giỏ

**What to build:** Người mua có thể giữ một Giỏ hàng trên storefront, thêm/sửa/xoá đúng Biến thể size × màu, nhận giá hiện tại và gộp Giỏ hàng vãng lai vào tài khoản sau đăng nhập.

**Blocked by:** 24-category-content

**Status:** ready-for-agent

- [ ] Guest nhận Giỏ hàng gắn phiên ổn định, hết hạn sau 30 ngày không hoạt động.
- [ ] Thêm, sửa và xoá Biến thể giữ số lượng hợp lệ từ 1 đến 10 cho mỗi dòng; giỏ không trừ hoặc giữ Tồn kho.
- [ ] Giỏ hiển thị Giá áp dụng hiện tại và báo rõ khi giá thay đổi sau lần thêm trước.
- [ ] Đăng nhập gộp hai giỏ theo Khách hàng; cộng dòng trùng, cắt số lượng theo giới hạn 10 và đóng giỏ vãng lai.
- [ ] Cung cấp kịch bản HTTP end-to-end có thể tự xác minh cho Guest và Customer.
