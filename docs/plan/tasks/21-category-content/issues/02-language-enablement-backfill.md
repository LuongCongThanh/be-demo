---
status: todo
pr:
blocked-by: [01-locale-translation-compatibility]
---

# Bật/tắt ngôn ngữ và tự dịch category

Parent: [Hoàn thiện hợp đồng category cho CMS và store](../spec.md)
Plan: [Giai đoạn B — mở rộng đa ngôn ngữ](../plan.md)
Readiness: ready-for-agent

## What to build

Admin bật một ngôn ngữ nội dung category và store có thể đọc tên category theo ngôn ngữ đó. Category cũ và mới được tự dịch nền, thiếu bản dịch dùng tên Việt; tắt ngôn ngữ không xóa bản dịch.

## Blocked by

[Chuyển bản dịch Anh sang mô hình theo locale](01-locale-translation-compatibility.md)

## Acceptance criteria

- [ ] Danh sách ngôn ngữ được lưu và seed vi/en idempotent. Admin xem/bật/tắt bằng quyền category view/manage; public chỉ liệt kê các ngôn ngữ đang bật. Không cho tắt tiếng Việt làm nguồn.
- [ ] Locale được kiểm tra theo danh sách provider hỗ trợ; không nhận mã tùy ý để gửi tới Google. Locale category không hợp lệ hoặc chưa bật trả 400; thiếu locale mặc định vi.
- [ ] Public category tree/detail resolve name theo locale đang bật, fallback Việt, giữ id/slug/sắp xếp và quy tắc nhánh ẩn; các trường compatibility Anh tiếp tục đúng.
- [ ] Bật locale tạo công việc dịch nền cho category hiện có theo batch, tiếp tục được sau restart; category tạo đồng thời với enable không bị bỏ sót; bật lặp không tạo bản dịch trùng.
- [ ] Worker gọi Google với target locale, claim/complete theo bản dịch. Tắt locale ngừng claim, kết quả đang chạy không commit sau khi locale bị tắt; bật lại không cho kết quả của lần bật cũ ghi đè.
- [ ] Tắt không xóa bản dịch; bật lại giữ bản sửa tay, đánh dấu REVIEW nếu nguồn đổi, và queue lại bản máy lỗi thời. Đổi tên Việt xử lý các locale độc lập; thiếu key giữ pending, lỗi provider đánh dấu FAILED từng locale.
- [ ] HTTP/integration kiểm chứng ít nhất ba locale với fake provider, enable/disable/re-enable/restart và race tạo category; kiểm quyền, validation và fallback.
- [ ] Unit/integration liên quan, lint, typecheck, build pass; OpenAPI và hướng dẫn API/cấu hình ngôn ngữ được cập nhật.

## Notes

Phạm vi là nội dung Category. Không tự dịch chữ giao diện, Product, hoặc bổ sung locale router/formatting cho store. Không gọi dịch vụ có phí trong test; reuse adapter Google và cơ chế nhất quán đã có ở ticket trước.
