---
status: done
pr: https://github.com/LuongCongThanh/be-demo/pull/120
blocked-by: []
---

# Tính thử và đặt đơn COD

**What to build:** Buyer có thể nhận Quote chính xác, xác nhận và đặt đơn COD trong khi hệ thống trừ tồn kho, áp Voucher, tính phí ship và tạo bản ghi đơn atomic.

**Blocked by:** — (vertical slice nhận dòng hàng trực tiếp)

**Status:** done

- [x] Checkout nhận địa chỉ tỉnh/thành và phường/xã; dùng phí ship dự phòng 30.000đ cho slice hiện tại.
- [x] Quote hết hạn sau 15 phút, không giữ hàng; lưu snapshot dòng, giá, Voucher, phí ship và tổng.
- [x] Tính miễn phí ship sau Voucher từ ngưỡng mặc định 500.000đ.
- [x] Khi đặt đơn, backend tính lại và từ chối thay đổi giá, Voucher, tồn kho, phí ship hoặc tổng so với Quote đã xác nhận.
- [x] Quote nhận tối đa một Voucher; Voucher chỉ giảm Tạm tính.
- [x] COD chỉ được chốt khi Tổng tiền không vượt mặc định 10.000.000đ; một giao dịch trừ tồn, ghi Hàng chờ xuất và Voucher usage.
- [x] Placement yêu cầu Idempotency-Key; cùng key khác body trả 409 và retry đúng cùng key không tạo đơn trùng.

## Ghi chú phạm vi source

Cart backend chưa được triển khai ở task 26, nên endpoint quote nhận các dòng Biến thể trực tiếp thay vì đọc Cart; GHN integration và cấu hình phí vận chuyển thuộc phần tích hợp tiếp theo. Trong slice hiện tại, quote/đơn ghi rõ cờ sử dụng phí dự phòng. Địa chỉ được lưu theo hai mã hành chính, chưa xác minh mã với danh mục tỉnh/phường.
