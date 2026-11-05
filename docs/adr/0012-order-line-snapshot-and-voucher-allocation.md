# Dòng đơn hàng lưu bản chụp giá và phần Voucher được phân bổ tại thời điểm đặt

Mỗi Dòng đơn hàng lưu bản chụp tên Sản phẩm, SKU, size, màu, đơn giá, mức giảm và `voucher_discount` (BR-ORD-02). Voucher được phân bổ một lần lúc tạo đơn theo tỷ lệ giá trị dòng, thứ tự ổn định theo `variant_id`, phần lẻ dồn về dòng cuối và luôn `0 <= d_i <= L_i`, `SUM(d_i) = D` (thuật toán ở `business/04-business-rules.md` §5). Mọi số tiền là số nguyên VND.

Lý do: Hoàn tiền khi Đổi trả một phần = phần Người mua **đã thực trả** cho số lượng được chấp nhận (BR-RET-07). Nếu tính lại từ giá/Voucher hiện tại thì kết quả trôi theo mỗi lần Admin sửa giá; nếu chỉ lưu tổng đơn thì không chia được chính xác về từng dòng.

Phương án bị loại: chỉ lưu tổng giảm giá ở cấp đơn và phân bổ lúc hoàn (kết quả phụ thuộc thời điểm tính, khó đối chiếu); tham chiếu giá sống của Biến thể (sửa Sản phẩm làm đổi đơn cũ).

Hệ quả: bản chụp bất biến sau khi tạo; thay đổi thuật toán phân bổ chỉ áp dụng cho đơn mới.
