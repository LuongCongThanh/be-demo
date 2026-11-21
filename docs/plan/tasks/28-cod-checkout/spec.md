---
status: todo
pr:
blocked-by:
  - 26-buyer-cart
  - 27-inventory-availability
---

# Tính thử và đặt đơn COD

**What to build:** Buyer có thể nhận Quote chính xác, xác nhận và đặt đơn COD trong khi hệ thống trừ tồn kho, áp Voucher, tính phí ship và tạo bản ghi đơn atomic.

**Blocked by:** 26-buyer-cart, 27-inventory-availability

**Status:** ready-for-agent

- [ ] Checkout hỗ trợ địa chỉ hai cấp Việt Nam và tính Phí ship từ GHN hoặc Phí ship dự phòng khi GHN lỗi.
- [ ] Quote có thời hạn, không giữ hàng và chụp dòng, giá, Voucher, phí ship và tổng để người mua xác nhận.
- [ ] Khi đặt đơn, backend tính lại và từ chối thay đổi giá, Voucher, tồn kho, phí ship hoặc tổng so với Quote đã xác nhận.
- [ ] Một Voucher duy nhất áp được; Voucher thứ hai thay Voucher cũ và không giảm phí ship.
- [ ] COD chỉ được chốt khi Tổng tiền không vượt Hạn mức COD; đơn thành công trừ Tồn kho, tạo Hàng chờ xuất và Voucher usage trong cùng giao dịch.
- [ ] Placement yêu cầu Idempotency-Key; cùng key khác body trả 409 và retry đúng cùng key không tạo đơn trùng.
