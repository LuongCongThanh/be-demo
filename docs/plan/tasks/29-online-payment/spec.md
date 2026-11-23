---
status: done
pr: https://github.com/LuongCongThanh/be-demo/pull/129
blocked-by:
  - 28-cod-checkout
---

# Thanh toán online và đối soát

**Mục tiêu:** Người mua có thể đặt đơn online qua VNPay hoặc MoMo, chỉ nhận xác nhận từ IPN/đối soát và giữ trạng thái tiền/đơn nhất quán khi hết hạn, trùng thông báo hoặc sai số tiền.

**Phụ thuộc:** 28-cod-checkout

**Trạng thái:** done

- [x] Đặt đơn online từ báo giá còn hạn, tính lại dấu vân tay, tạo Order `PENDING_PAYMENT`, lượt Voucher và Giữ hàng cho từng biến thể trong cùng transaction; thiếu hàng hoặc báo giá thay đổi thì rollback toàn bộ.
- [x] Lưu mỗi lần thử thành một Payment riêng; cho phép chọn VNPay/MoMo ở từng lần thử; cả hai adapter tuân cùng hợp đồng tạo link, xác minh IPN và truy vấn trạng thái.
- [x] Mọi link hết hạn tại thời điểm đặt đơn +10 phút; không tạo lần thử mới từ phút thứ 7; Payment attempt có idempotency key.
- [x] Chỉ IPN hợp lệ hoặc đối soát mới xác nhận Payment; Return URL chỉ hiển thị trạng thái chờ xác nhận.
- [x] Khử trùng IPN theo gateway + mã giao dịch/sự kiện; lặp lại không áp dụng tác động nghiệp vụ hai lần.
- [x] Số tiền captured phải khớp tổng Order. Sai lệch không chuyển Order sang `PLACED`, tạo cờ và yêu cầu hoàn đúng số tiền đã nhận.
- [x] Payment thành công khi Order còn `PENDING_PAYMENT` chuyển giữ hàng thành trừ Tồn kho + Hàng chờ xuất, cập nhật Order và Payment trong cùng transaction.
- [x] Tiền về cho Order đã huỷ/đã thanh toán hoặc không còn hợp lệ không làm sống lại Order; tạo đúng một yêu cầu hoàn gắn với Payment và cờ xử lý.
- [x] Job đối soát định kỳ dùng cùng bộ xử lý/idempotency với IPN; settlement và hết hạn khóa Order trước Payment/tồn kho; unit test bao phủ IPN trùng, sai số tiền, payment muộn và hết hạn.

## Phạm vi

- Bao gồm: schema/migration Payment, inbox IPN, giữ hàng cần cho online checkout, cờ/yêu cầu hoàn tối thiểu cho sai lệch và khoản thu bất ngờ, gateway VNPay/MoMo, API checkout/payment, đối soát định kỳ.
- Không bao gồm: Staff API/UI ghi nhận hoàn tiền thủ công, các nghiệp vụ huỷ/đổi trả đầy đủ, email, GHN và triển khai merchant credentials/UAT production.
- Nguồn quy tắc: [BR-PAY-01..05 và BR-INV-05](../../../business/04-business-rules.md), [vòng đời Order §3–4.2](../../../business/05-order-lifecycle.md), [tích hợp thanh toán](../../../architecture/06-integrations.md#2-thanh-toán-vnpay-và-momo), [ADR 0003](../../../adr/0003-inventory-reservations-and-transactional-outbox.md), [ADR 0004](../../../adr/0004-payment-gateways-vnpay-momo-cod.md), [ADR 0006](../../../adr/0006-manual-refund-mvp-scope.md).
