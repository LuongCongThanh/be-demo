---
status: done
pr:
blocked-by: []
---

# Tồn kho và điều chỉnh Staff

**What to build:** Staff hoặc Admin có thể kiểm soát Tồn kho một Kho một cách nhất quán và ngăn mọi điều chỉnh tạo oversell.

- [x] Dữ liệu Tồn kho thuộc mô-đun inventory và trả OnShelf, reserved, available.
- [x] Điều chỉnh tăng hoặc giảm bắt buộc lý do; mọi thay đổi tạo movement có actor và before/after.
- [x] Điều chỉnh giảm không vượt AvailableQuantity và trả giới hạn tối đa khi bị từ chối.
- [x] Kiểm kê lưu snapshot Tồn kho/Hàng chờ xuất; confirmation tính lại chênh lệch từ Tồn kho + Hàng chờ xuất hiện tại.
- [x] Giao dịch lock inventory và movement/count được tạo trong transaction.
