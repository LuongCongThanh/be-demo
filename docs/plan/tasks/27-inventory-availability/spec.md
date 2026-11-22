---
status: todo
pr:
blocked-by:
  - 26-buyer-cart
---

# Tồn kho và điều chỉnh Staff

**What to build:** Staff hoặc Admin có thể kiểm soát Tồn kho một Kho một cách nhất quán và ngăn mọi điều chỉnh tạo oversell.

**Blocked by:** 26-buyer-cart

**Status:** ready-for-agent

- [ ] Dữ liệu Tồn kho chỉ thuộc mô-đun inventory và luôn cho biết Tồn kho, Giữ hàng, Số lượng bán được và Hàng trên kệ.
- [ ] Điều chỉnh tăng hoặc giảm bắt buộc lý do; mọi thay đổi tạo movement có người thực hiện, giá trị trước/sau và thời điểm.
- [ ] Điều chỉnh giảm không vượt Số lượng bán được và trả số tối đa có thể điều chỉnh khi bị từ chối.
- [ ] Kiểm kê so số đếm thực tế với Tồn kho cộng Hàng chờ xuất, tính lại chênh lệch tại lúc xác nhận.
- [ ] Giao dịch đồng thời không tạo tồn kho âm, oversell hoặc double restock.
