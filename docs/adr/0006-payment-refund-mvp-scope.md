---
decision_status: accepted
implementation_status: planned
decided_at: 2026-09-17
last_verified: 2026-09-23
related_spec: ../specs/08-payments.md
---

# Giới hạn phạm vi Payment/Refund ở mức full-refund-only, có review của con người cho khoản thu dư

MVP chỉ hoàn tiền toàn phần (full refund) cho một Payment — không hoàn tiền một phần theo OrderItem/số lượng — và xử lý trường hợp thu dư của Payment (hai giao dịch MoMo khác nhau thật sự đều thành công cho cùng một Order) như một khoản refund cần `STORE_MANAGER` review, không bao giờ tự động kích hoạt. Cả hoàn tiền một phần lẫn tự động hoàn tiền cho khoản dư đều đã được cân nhắc và loại bỏ ở giai đoạn này: chúng làm tăng rủi ro tiền thật và độ phức tạp reconciliation trong khi chưa có test coverage, còn việc khách hủy đơn vẫn được phép sau khi Order đạt `CONFIRMED`, miễn là Fulfillment chưa bắt đầu (`UNFULFILLED`) — sau mốc đó, đây là một quy trình return/exception, không phải cancel. Một giao dịch thanh toán thành công đến trễ (sau khi reservation đã hết hạn) sẽ để Order ở nguyên trạng thái `CANCELLED`; việc "còn tiền cần hoàn" được phản ánh hoàn toàn ở trạng thái `REFUND_PENDING`/`REFUNDED` của Payment, không tạo thêm một trạng thái Order thứ hai.

Retry cho một Payment được phép **không giới hạn số lần**, miễn Order còn `PENDING_PAYMENT` và reservation của nó còn `ACTIVE` và chưa hết hạn — cửa sổ giữ hàng 15 phút chính là giới hạn retry tự nhiên, MVP không thêm một mức trần số lần attempt riêng. Một Payment Attempt bị provider từ chối chuyển thành `FAILED`; nếu reservation vẫn mở thì Payment tổng thể vẫn retry được. Khi reservation hết hạn mà chưa có attempt thành công, Payment tổng thể chuyển thành `EXPIRED`, không phải `FAILED`. Phương án thêm một giới hạn cứng (ví dụ tối đa 3-5 lần thử) đã được cân nhắc và loại bỏ vì cửa sổ reservation đã đóng vai trò giới hạn tự nhiên.

Chưa implement: schema hiện chưa có Payment, Payment Attempt, Refund, Fulfillment hoặc Inventory Reservation.
