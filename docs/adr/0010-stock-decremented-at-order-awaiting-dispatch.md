# Trừ Tồn kho khi đơn được xác lập, theo dõi phần đã bán là Hàng chờ xuất

Tồn kho bị trừ ngay khi đơn được xác lập — lúc đặt đơn COD thành công (BR-INV-04), hoặc lúc đơn online thanh toán thành công và Giữ hàng được chuyển đổi (BR-INV-05) — không phải lúc Bàn giao cho GHN. Phần đã trừ nhưng chưa Bàn giao được theo dõi theo Mã đơn là **Hàng chờ xuất**, xoá khi Vận đơn tạo xong (BR-INV-10). Do đó: Hàng trên kệ = Tồn kho + Hàng chờ xuất; Kiểm kê so số đếm với tổng này (BR-INV-12); huỷ trước Đang giao trả Hàng chờ xuất về Tồn kho (BR-INV-07).

Phương án bị loại: trừ Tồn kho lúc Bàn giao và để đơn đã xác lập là một loại Giữ hàng không hết hạn — khiến "Giữ hàng" mang hai nghĩa (có hạn / vô hạn), và Số lượng bán được phụ thuộc vào trạng thái Vận đơn.

Hệ quả: cần bảng Hàng chờ xuất (theo đơn × Biến thể) và sổ biến động Tồn kho (BR-INV-09); mọi chuyển đổi Giữ hàng → trừ Tồn kho → Hàng chờ xuất nằm trong một transaction.
