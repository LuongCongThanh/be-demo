# Dùng Giữ hàng tường minh và transactional outbox

Đơn **thanh toán online** tạo một Giữ hàng có thời hạn **15 phút** dưới dạng bản ghi `inventory_reservations` trong PostgreSQL; link thanh toán hết hạn ở phút thứ 10 và không tạo link mới từ phút thứ 7 (BR-INV-05). Đơn **COD** không tạo Giữ hàng mà trừ Tồn kho ngay (BR-INV-04, xem [ADR 0010](./0010-stock-decremented-at-order-awaiting-dispatch.md)). Số lượng bán được = Tồn kho − tổng Giữ hàng còn hiệu lực (BR-INV-02).

Domain event (đơn đã đặt, đã thanh toán, đã huỷ…) được ghi vào bảng outbox trong **cùng transaction** với thay đổi Order và Tồn kho; worker đọc outbox để gửi email, tạo Vận đơn GHN, v.v.

Phương án bị loại: chỉ cập nhật bộ đếm `reserved_quantity` (không kiểm chứng được Giữ hàng nào hết hạn lúc nào, khó phục hồi khi worker chết), và publish thẳng lên BullMQ sau commit (mất event nếu process chết giữa commit và publish; biến Redis thành nguồn dữ liệu chính).

Hệ quả: thêm bảng và worker; job huỷ đơn `PENDING_PAYMENT` quá 15 phút chạy mỗi phút (`business/05-order-lifecycle.md` §5). Cuộc đua giữa thanh toán thành công và hết hạn được giải bằng một chuyển trạng thái atomic có điều kiện trên Giữ hàng — chỉ một bên thắng; tiền về sau khi thua xử lý theo BR-PAY-05.
