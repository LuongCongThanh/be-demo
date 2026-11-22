# Kế hoạch triển khai tính năng MVP cửa hàng thời trang Việt Nam

## Destination

Một implementation plan có thứ tự và phụ thuộc cho các capability sản phẩm trong MVP ở `docs/business/`, đủ rõ để bắt đầu thực hiện. Tập trung vào trải nghiệm khách hàng/nhân viên và các luồng backend, CMS, storefront cần để hỗ trợ chúng; map này làm rõ quyết định, không triển khai code.

## Notes

- Bối cảnh: thương hiệu thời trang B2C tại Việt Nam; backend-first, gồm storefront/CMS và back-office.
- Đọc `docs/business/` làm nguồn yêu cầu chính; nếu mâu thuẫn với architecture/ADR, business docs có ưu tiên theo `AGENTS.md`. Tham khảo `GLOSSARY.md` và `docs/adr/` để dùng đúng thuật ngữ.
- Ưu tiên critical path theo vertical slice của tính năng: catalog/identity, cart/checkout/order, tồn kho/thanh toán/giao hàng và các màn hình CMS/store cần thiết.
- Giữ các yêu cầu security/tích hợp khi trực tiếp cần để tính năng hoạt động; không mở rộng thành audit compliance hoặc lập kế hoạch hạ tầng.
- Tính đến task 17 và 24 để không tạo trùng lặp tính năng. Task 11 là deploy demo, ngoài phạm vi map tính năng này.
- Phạm vi và các quy tắc xuyên luồng được định hướng trong [tài liệu umbrella MVP thương mại](../../tasks/25-mvp-commerce-end-to-end/spec.md); tiêu chí nghiệm thu và triển khai thuộc các nhiệm vụ 26–36. Dùng `research` cho dữ kiện còn thiếu và `grilling`/`domain-modeling` cho quyết định cần chủ dự án, nhưng không giao quyền sở hữu triển khai cho tài liệu umbrella.

## Decisions so far

- [Lập đường cơ sở độ bao phủ MVP hiện tại](./issues/01-mvp-coverage-baseline.md): catalog/admin đã có nền tảng; các khoảng trống tính năng chính là auth storefront, locale CMS/store và commerce end-to-end.
- [Xác minh giới hạn API GHN và chu kỳ đối soát](./issues/05-ghn-reconciliation-limits.md): webhook là đường cập nhật chính, polling 15 phút là fallback; tài liệu công khai không cam kết rate limit hay freshness SLA.
- [Chốt chu kỳ đối soát trạng thái GHN và xử lý ngoại lệ](./issues/10-ghn-reconciliation-cadence.md): giữ polling 15 phút làm fallback; retry có backoff và cảnh báo kỹ thuật khi lỗi kéo dài, không áp dụng trạng thái không hợp lệ hoặc mâu thuẫn.
- [Khuyến nghị kiểm soát xác thực và chống dò đơn hàng](./issues/06-auth-abuse-control-guidance.md): baseline gồm mật khẩu 15 ký tự, throttling theo account/IP, khóa tạm và credential tra cứu guest khó đoán với phản hồi đồng nhất.
- [Ngưỡng xác thực và tra cứu đơn guest](./issues/11-auth-and-order-lookup-thresholds.md): đăng nhập khóa tài khoản 15 phút sau 5 lần sai/15 phút, tra cứu guest giới hạn 10 lần sai/IP/15 phút, và quên mật khẩu giới hạn 5 yêu cầu/15 phút với phản hồi chung.

## Current implementation frontier

- Phạm vi tính năng, thứ tự vertical slice và các trạng thái ngoại lệ đã được tổng hợp trong tài liệu umbrella và các đặc tả nhiệm vụ 26–36; map này không còn theo dõi các yêu cầu tính năng chưa đặc tả.
- Nhiệm vụ 17 và 24 là các điều kiện nền trước khi những lát cắt phụ thuộc vào quyền quản trị và hợp đồng danh mục/locale được triển khai. Trạng thái hiện tại và thứ tự tiếp theo được theo dõi trong [bảng nhiệm vụ](../../README.md).

## Out of scope

- Thực thi tính năng hoặc thay đổi code trong effort lập map này.
- Nhu cầu không có trong MVP Việt Nam hiện được mô tả trong `docs/business/`; nếu destination thay đổi, hãy mở effort mới.
- Nghiên cứu nghĩa vụ bảo vệ dữ liệu cá nhân được chủ dự án yêu cầu dừng; đã đóng ngoài phạm vi, không dùng kết quả nghiên cứu trong route này ([Xác minh nghĩa vụ bảo vệ dữ liệu và chuyển dữ liệu xuyên biên giới tại Việt Nam](./issues/02-vietnam-data-protection-obligations.md)).
- Không xác lập chính sách lưu giữ, xóa hoặc ẩn danh dữ liệu khách hàng trong map này; không suy đoán chính sách từ nghiên cứu đã loại khỏi phạm vi ([Chọn chính sách lưu giữ/xóa/ẩn danh dữ liệu khách hàng](./issues/08-customer-data-lifecycle-policy.md)).
- Nghiên cứu nghĩa vụ hóa đơn điện tử và chọn luồng hóa đơn đã bị loại khỏi map tính năng; không dùng kết quả pháp lý trong plan tính năng ([Xác minh nghĩa vụ hóa đơn điện tử cho thương mại điện tử](./issues/03-vietnam-e-invoicing-obligations.md), [Chọn luồng hóa đơn điện tử MVP](./issues/09-mvp-invoice-operating-model.md)).
- Thủ tục thông báo website với cơ quan quản lý là công việc compliance riêng, không thuộc map tính năng ([Xác minh thủ tục thông báo website thương mại điện tử](./issues/04-vietnam-ecommerce-notification.md)).
- Hosting, capacity và cổng mở rộng tải thuộc kế hoạch hạ tầng/deployment riêng ([Đánh giá hạ tầng pilot/scale theo tải 500–5.000 đơn/ngày](./issues/07-pilot-hosting-capacity.md), [Chọn cấu hình triển khai pilot và cổng mở rộng tải](./issues/12-pilot-hosting-and-scale-gates.md)).
