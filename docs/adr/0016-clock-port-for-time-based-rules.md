# Thời gian nghiệp vụ đi qua `Clock` port

Mọi code nghiệp vụ đọc giờ hiện tại qua một `Clock` port của project (cùng kiểu với `TransactionRunner`), không gọi thẳng `new Date()` hay `Date.now()`. Adapter production trả giờ hệ thống; test dùng fake clock đặt và tua được. Lý do: nhiều luật phụ thuộc mốc thời gian (Giữ hàng 15 phút và link thanh toán 10 phút, BR-INV-05; giỏ vãng lai 30 ngày, BR-CRT-02; hiệu lực Voucher, BR-VCH-04; Giá khuyến mãi, BR-PRC-03; 7 × 24 giờ Đổi trả, BR-RET-01; ngày Hoàn tất theo giờ Việt Nam, BR-REV-01), và API test chạy app thật cần kiểm đúng các mốc đó mà không chờ thời gian thật. Port được đưa vào trong chuỗi migrate Hexagonal (ADR 0015), ở module đầu tiên cần nó, rồi lần lượt các module còn lại.

Endpoint hoặc cơ chế tua giờ cho E2E full-stack chỉ được đăng ký trong môi trường test; build production không có nó.

## Considered Options

- **Sửa trực tiếp timestamp trong DB** (lùi `created_at`, `expires_at` trước khi gọi API): không cần đổi code, nhưng test biết chi tiết lưu trữ, vỡ khi đổi schema, và không dùng được cho logic đọc giờ hiện tại trong bộ nhớ (link thanh toán phút 7 và 10).
- **`vi.useFakeTimers()`**: đủ cho unit, nhưng không dùng được qua HTTP với app thật, Prisma và driver Postgres, và có thể làm treo timer của thư viện.
- **Chờ thời gian thật**: không khả thi với mốc 15 phút hay 7 ngày.
