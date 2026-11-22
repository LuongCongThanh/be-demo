# Một outbox event chỉ "xong" khi có downstream acknowledgement, không phải khi enqueue

Một dòng outbox chỉ ở trạng thái `done` sau khi downstream xác nhận tác dụng phụ thành công; nếu hết retry mà chưa được xác nhận, chuyển sang `failed` và báo cần xử lý — không coi là `done`. Enqueue vào BullMQ không phải hoàn tất: Redis có thể làm mất job trước khi worker chạy, nên cần giữ trạng thái đang chờ xác nhận và quét đối chiếu để phát hiện, enqueue lại dòng bị kẹt. Vòng đời trạng thái và retry chi tiết: [07-async-events-jobs.md](../architecture/07-async-events-jobs.md).
