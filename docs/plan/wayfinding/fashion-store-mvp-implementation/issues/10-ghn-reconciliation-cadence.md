Type: grilling
Status: resolved
Blocked by: 05

## Question

Dựa trên kết quả ticket 05, chốt tần suất đối soát GHN cho MVP và cách xử lý trạng thái lỗi/chậm/không nhất quán. Cân bằng độ mới trạng thái đơn, giới hạn API và khả năng vận hành; quyết định có giữ chu kỳ 15 phút hay thay thế.

## Answer

Giữ webhook làm nguồn cập nhật trạng thái chính và polling GHN mỗi 15 phút làm cơ chế đối soát dự phòng. Chu kỳ 15 phút là lựa chọn vận hành cho MVP, không phải cam kết quota API hay SLA độ mới vì tài liệu GHN công khai không xác nhận các giới hạn đó.

Khi truy vấn GHN thất bại, giữ nguyên trạng thái hiện tại và thử lại với backoff; nếu lỗi kéo dài quá ngưỡng retry hiện hành (10 lần trong 24 giờ), cảnh báo đội kỹ thuật. Chỉ áp dụng trạng thái nếu chuyển trạng thái hợp lệ. Bỏ qua thông báo trùng hoặc báo bước đã qua; giữ và thử lại thông báo đến sớm; chỉ ghi log, không áp dụng thông báo mâu thuẫn. Lỗi kỹ thuật tạm thời không tự tạo Cờ cần xử lý vận đơn.
