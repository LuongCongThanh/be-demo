# Thanh toán qua VNPay, MoMo và COD sau một ranh giới Cổng thanh toán trung lập

Thay thế quyết định cũ "MoMo là provider đầu tiên".

MVP hỗ trợ **COD** và thanh toán online qua **VNPay** hoặc **MoMo** (BR-PAY-01). Phương thức COD/online chốt khi đặt đơn; Cổng online được chọn ở **mỗi lần trả tiền**, nên một đơn có thể có nhiều lần thử trên nhiều Cổng. Mỗi Cổng là một adapter sau interface `PaymentGateway` chung (tạo link, xác thực chữ ký IPN, truy vấn đối soát). Trạng thái chỉ được xác nhận qua IPN hoặc job Đối soát mỗi 5 phút, không bao giờ qua Return URL (BR-PAY-02); IPN trùng chỉ xử lý một lần (BR-PAY-03).

Phương án bị loại: chỉ một Cổng (MoMo) — không khớp yêu cầu business; Stripe/PayPal — ngoài phạm vi vì chỉ bán trong nước, chỉ VND (`01-vision-scope.md` §5.3).

Hệ quả: `payments` (một bản ghi cho mỗi lần thử, có `gateway`) tách khỏi `orders`; mọi số tiền là số nguyên VND. Go-live phụ thuộc hợp đồng merchant và UAT sandbox của cả hai Cổng.
