# Đơn chỉ được tạo khi khớp Tính thử Người mua đã xác nhận

Checkout là hai bước: **Tính thử** (backend tính dòng, giá, Voucher, phí ship GHN, tổng; có hạn, không Giữ hàng, không cam kết giá) rồi **đặt đơn** kèm tham chiếu tới Tính thử đó. Lúc đặt, backend tính lại trong transaction (không tin giá frontend); nếu dòng, giá hay điều kiện bán khác ở **bất kỳ điểm nào** thì không tạo đơn và Người mua phải xác nhận Tính thử mới — kể cả khi tổng tình cờ không đổi (BR-ORD-07). Tổng phải > 0 (BR-ORD-09). Bị từ chối thì không tạo Order, Payment, Giữ hàng, Hàng chờ xuất hay lượt dùng Voucher.

Phương án bị loại: chỉ so tổng tiền (che giấu thay đổi giá bù trừ nhau giữa các dòng); tự điều chỉnh rồi tạo đơn (Người mua bị tính khác cái đã đồng ý); Giữ hàng ngay từ Tính thử (giữ tồn kho cho người chỉ xem giá).

Hệ quả: Tính thử là một bản ghi có hạn, đặt đơn cần idempotency key để retry không tạo đơn trùng.
