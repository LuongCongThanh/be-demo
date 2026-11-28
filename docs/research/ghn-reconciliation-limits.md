# GHN API: giới hạn, độ mới trạng thái và chu kỳ đối soát

- **Ngày truy cập tài liệu:** 2026-11-21
- **Ticket:** `docs/plan/initiatives/fashion-store-mvp-implementation/issues/05-ghn-reconciliation-limits.md`
- **Phạm vi:** tài liệu API chính thức tại `developer.ghn.vn`; đây là đánh giá cho MVP, không phải SLA hay cam kết hạn mức của GHN.

## Kết luận

**Giữ chu kỳ 15 phút cho polling đối soát dự phòng trong MVP; không dùng polling làm cơ chế cập nhật chính.** GHN hướng dẫn nhận thay đổi trạng thái bằng webhook để đồng bộ realtime và nói rõ cơ chế này không cần polling. Polling detail mỗi 15 phút là một khoảng kiểm tra hợp lý để phát hiện webhook bị bỏ lỡ, nhưng tài liệu công khai không quy định chu kỳ polling bắt buộc, hạn mức gọi REST, hay SLA độ trễ. Do đó không thể khẳng định 15 phút sẽ luôn nằm trong quota hoặc bảo đảm trạng thái mới trong tối đa 15 phút.

Nếu polling mọi vận đơn còn hoạt động theo lịch này, mức trần danh nghĩa là **4 lượt tra cứu/vận đơn/giờ** hoặc **96 lượt/vận đơn/ngày**. Con số này là phép tính theo lịch, không phải quota GHN xác nhận.

## Cách lấy trạng thái

- GHN cung cấp `GET /shiip/public-api/v2/shipping-order/detail`, tra cứu theo `order_code`; yêu cầu header `Token` và `ShopId`. Response có `status`, `updated_date` (thời điểm cập nhật cuối), cùng `leadtime` (thời điểm giao dự kiến). Có endpoint tương đương `detail-by-client-code` nếu cần tra bằng mã đơn nội bộ. [Order Info — Endpoint, Headers, Response Fields](https://developer.ghn.vn/en/docs/order/info); [Order Info by Client Order Code](https://developer.ghn.vn/en/docs/order/info-by-client-code).
- GHN giới thiệu webhook là cách nhận trạng thái đơn theo thời gian thực. Callback là `POST` JSON tới URL đăng ký; payload có `OrderCode`, `Type`, `Status`, và `Time` (thời điểm cập nhật đơn). [API Overview — Quickstart](https://developer.ghn.vn/en/docs/getting-started/overview); [Order Status Callback — Delivery, Payload](https://developer.ghn.vn/en/docs/webhook/callback-order-status).
- Webhook cần được bật/cấu hình ở Developer Portal. Thay đổi cấu hình có thể mất khoảng 15 phút để có hiệu lực do cache của GHN. **Đây là thời gian áp dụng thay đổi cấu hình webhook, không phải cam kết rằng mỗi sự kiện trạng thái được gửi trong 15 phút.** [Order Status Callback — Setup](https://developer.ghn.vn/en/docs/webhook/callback-order-status).

## Hạn mức API và độ mới dữ liệu

### Đã xác minh

- Các trang tài liệu API công khai đã rà soát mô tả xác thực, endpoint tra cứu, response và webhook; không công bố con số giới hạn request, cửa sổ quota, header quota hay chu kỳ polling yêu cầu. [API Overview](https://developer.ghn.vn/en/docs/getting-started/overview); [Order Info](https://developer.ghn.vn/en/docs/order/info); [Get Token](https://developer.ghn.vn/en/docs/token/get-token); [Order Status Callback](https://developer.ghn.vn/en/docs/webhook/callback-order-status).
- Endpoint detail trả về `updated_date`; callback mang `Time`, đều được tài liệu mô tả là thời điểm cập nhật gần nhất của đơn. GHN mô tả webhook là realtime, nhưng không nêu độ trễ đầu-cuối tối đa hay SLA thời điểm trạng thái xuất hiện trên gateway. [Order Info — Response Fields](https://developer.ghn.vn/en/docs/order/info); [Order Status Callback — Payload](https://developer.ghn.vn/en/docs/webhook/callback-order-status).

### Chưa biết từ tài liệu công khai

- Hạn mức REST cụ thể theo token, shop, tài khoản, IP hay endpoint; có hay không giới hạn riêng cho endpoint detail.
- REST API có trả `429` khi quá tải hay không; nếu có, có `Retry-After` hoặc quota header hay không.
- Độ trễ tối đa từ lúc GHN ghi nhận chuyển trạng thái đến lúc detail endpoint và webhook phản ánh trạng thái đó; không có freshness SLA được công bố trong các trang đã rà soát.
- Tỷ lệ lỗi/độ trễ thực tế ở production và ảnh hưởng của khối lượng polling.

Không nên hiểu việc không thấy quota trong các trang đã rà soát là GHN không áp dụng giới hạn. Trước khi tăng khối lượng cần xác nhận quota với GHN và đo hành vi trên tài khoản production.

## Webhook: giao nhận và retry

- GHN yêu cầu server xác nhận thành công bằng HTTP `2xx`; timeout mặc định là 5 giây, có thể cấu hình 1–60 giây. Số lần retry cấu hình được là 1–5. [Order Status Callback — Setup, Delivery](https://developer.ghn.vn/en/docs/webhook/callback-order-status).
- Callback có thể được gửi lặp; một thay đổi đơn có thể sinh nhiều callback theo event type. Tài liệu yêu cầu xử lý idempotent và gợi ý khóa khử trùng lặp `OrderCode + Type + Time`. [Order Status Callback — Delivery, Event types](https://developer.ghn.vn/en/docs/webhook/callback-order-status).
- GHN giao FIFO theo từng `OrderCode` và client. Một callback lỗi có thể chặn callback phía sau của cùng đơn cho đến khi thành công, bị loại vĩnh viễn hoặc hết lượt thử. Các đơn khác độc lập. [Order Status Callback — Ordering](https://developer.ghn.vn/en/docs/webhook/callback-order-status).
- Chính sách callback: `2xx` kết thúc thành công; `4xx` ngoại trừ `408`/`429` bị xem là lỗi vĩnh viễn và không retry; `5xx`, `408`, `429`, timeout/không phản hồi được retry. Backoff được công bố lần lượt là 30 giây, 2, 5, 10, 20, 30 phút, rồi 1, 2, 3, 6 và 12 giờ. Tổng lượt gửi là `1 + num_retry` theo cấu hình; retry quá backoff có thể được xếp chạy trong khoảng 10 giây tiếp theo. Đây là chính sách **GHN gửi webhook**, không phải hướng dẫn retry cho REST polling. [Order Status Callback — Retry](https://developer.ghn.vn/en/docs/webhook/callback-order-status).

## REST polling: lỗi và retry đề xuất

Tài liệu Order Info liệt kê: đơn không tồn tại `400`; tài khoản không có quyền xem chi tiết `403`; đơn không thuộc shop của tài khoản `400`; lỗi nội bộ `500`. [Order Info — Error Codes](https://developer.ghn.vn/en/docs/order/info).

Đề xuất cho client MVP (không phải chính sách retry REST do GHN công bố):

1. Với `400` do mã đơn không tồn tại/không thuộc shop và `403` do quyền, không retry liên tục; đánh dấu cần kiểm tra dữ liệu hoặc cấu hình, phát cảnh báo phù hợp.
2. Với timeout, lỗi kết nối và `5xx`, retry có giới hạn bằng exponential backoff kèm jitter; duy trì ngân sách request và ghi nhận lỗi/độ trễ.
3. Nếu REST trả `429`, giảm tốc độ và tôn trọng `Retry-After` nếu response có header; tài liệu đã rà soát không xác nhận header hay thời gian chờ chuẩn.
4. Không để một lỗi webhook chặn xử lý nghiệp vụ vô thời hạn: lưu callback bền vững rồi trả `2xx`, xử lý bất đồng bộ, idempotent; có đối soát polling để phát hiện khoảng trống.

## Đánh giá chu kỳ 15 phút cho MVP

**Phù hợp làm chu kỳ reconciliation dự phòng**, với các điều kiện:

- Webhook là đường cập nhật chính; đăng ký và kiểm thử callback riêng trên staging và production vì hai môi trường/cấu hình tách biệt. [Get Token — Notes](https://developer.ghn.vn/en/docs/token/get-token); [Order Status Callback — Setup](https://developer.ghn.vn/en/docs/webhook/callback-order-status).
- Chỉ poll đơn còn ở trạng thái chưa kết thúc, dàn đều lịch để tránh burst, đặt giới hạn concurrency, và theo dõi request/giờ, lỗi, timeout, `429` (nếu có), cùng độ lệch giữa thời điểm cập nhật GHN và thời điểm hệ thống nhận được.
- Lưu `updated_date`/`Time`, áp dụng trạng thái mới một cách idempotent, và đối soát các callback bị bỏ lỡ. GHN liệt kê `delivered`, `returned`, `cancel`, `exception`, `lost`, `damage`, `scrap` là trạng thái cuối; `exception` vẫn cần quy trình xử lý thủ công thay vì hiểu là giao thành công. [Order Status Codes](https://developer.ghn.vn/en/docs/master-data/order-status).
- Khi gặp lỗi tạm thời, tăng thời gian chờ thay vì tiếp tục gọi đều 15 phút; 15 phút là lịch bình thường, không phải yêu cầu thử lại sau mọi lỗi.
- Đặt ngưỡng pilot để xác nhận tải thực tế; nếu sản lượng tăng, xin quota/SLA bằng văn bản từ GHN trước khi dựa vào polling thường xuyên.

### Tác động độ mới dự kiến

Với lịch 15 phút, hệ thống lấy mẫu trạng thái tối đa một lần mỗi 15 phút khi scheduler và GHN đều hoạt động. Vì vậy **khoảng chờ giữa hai lần lấy mẫu theo lịch có thể gần 15 phút**, nhưng đây không phải giới hạn trên của độ trễ quan sát: trạng thái có thể xuất hiện muộn ở GHN, job có thể trễ, request có thể lỗi, và GHN không công bố freshness SLA. Webhook giảm độ trễ kỳ vọng, nhưng tài liệu cũng không bảo đảm thời gian giao callback tối đa.

## Nguồn chính thức đã rà soát

Tất cả nguồn dưới đây thuộc Developer Portal chính thức của GHN và được truy cập ngày **2026-11-21**:

1. [API Overview](https://developer.ghn.vn/en/docs/getting-started/overview) — quickstart và môi trường API.
2. [Order Info](https://developer.ghn.vn/en/docs/order/info) — endpoint detail, timestamp, lỗi HTTP.
3. [Order Info by Client Order Code](https://developer.ghn.vn/en/docs/order/info-by-client-code) — tra cứu bằng mã đơn của client.
4. [Order Status Callback (Webhook)](https://developer.ghn.vn/en/docs/webhook/callback-order-status) — cấu hình, payload, retry, thứ tự sự kiện.
5. [Order Status Codes](https://developer.ghn.vn/en/docs/master-data/order-status) — danh mục và trạng thái cuối.
6. [Get Token](https://developer.ghn.vn/en/docs/token/get-token) — thông tin xác thực và tách biệt staging/production.
