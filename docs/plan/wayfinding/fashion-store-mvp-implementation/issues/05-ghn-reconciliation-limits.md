Type: research
Status: resolved

## Question

GHN API hiện giới hạn tần suất và cung cấp trạng thái vận đơn như thế nào, và chu kỳ đối soát 15 phút đang được đề xuất trong order lifecycle có phù hợp không? Dùng tài liệu/API chính thức hiện hành, ghi ngày kiểm tra, nêu giới hạn, độ mới dữ liệu, lỗi/retry cần tính đến và khuyến nghị chu kỳ cho MVP.

## Answer

Giữ polling 15 phút làm cơ chế đối soát dự phòng cho MVP; dùng webhook làm đường cập nhật chính. Tài liệu GHN công khai không nêu giới hạn REST rate hay SLA độ mới trạng thái, nên 15 phút không phải bảo đảm quota hoặc freshness. Chi tiết và nguồn chính thức ở [báo cáo GHN](https://github.com/LuongCongThanh/be-demo/blob/research/ghn-reconciliation-limits/research/ghn-reconciliation-limits.md).
