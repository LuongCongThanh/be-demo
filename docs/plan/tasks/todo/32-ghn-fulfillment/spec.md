---
status: todo
pr:
blocked-by:
  - 28-cod-checkout
  - 29-online-payment
---

# Vận đơn GHN và đối soát giao hàng

**What to build:** Hệ thống tạo và theo dõi Vận đơn GHN một cách idempotent, đồng thời xử lý webhook, polling dự phòng và trạng thái vận chuyển bất thường.

**Blocked by:** 28-cod-checkout, 29-online-payment

- [ ] Bàn giao tạo Vận đơn GHN nền; thất bại giữ đơn ở ĐANG ĐÓNG GÓI và gắn Cờ vận đơn.
- [ ] Thử lại bàn giao dùng lại Vận đơn đã tạo thay vì tạo vận đơn trùng.
- [ ] Webhook và polling áp dụng chỉ chuyển trạng thái hợp lệ, deduplicate theo sự kiện và bỏ qua mâu thuẫn/lặp.
- [ ] Polling GHN chạy mỗi 15 phút làm cơ chế dự phòng, retry có backoff và cảnh báo kỹ thuật sau lỗi kéo dài.
- [ ] Sự kiện mất/hư/sự cố/tự huỷ được gắn Cờ; trạng thái đơn không kẹt ở ĐANG GIAO.
