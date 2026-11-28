---
status: done
pr: #98
blocked-by: [02-language-enablement-backfill]
---

# Sửa tay và retry bản dịch theo ngôn ngữ

Parent: [Hoàn thiện hợp đồng category cho CMS và store](../spec.md)
Plan: [Giai đoạn B — mở rộng đa ngôn ngữ](../plan.md)
Readiness: ready-for-agent

## What to build

CMS có đủ API để quản trị viên chọn một ngôn ngữ, xem trạng thái và sửa một bản dịch tên category hoặc yêu cầu dịch lại, trong khi các bản dịch khác vẫn độc lập.

## Blocked by

[Bật/tắt ngôn ngữ và tự dịch category](02-language-enablement-backfill.md)

## Acceptance criteria

- [x] Admin đọc các bản dịch tên category kèm locale và trạng thái; PATCH theo locale sửa tay tên không rỗng, null xóa override và yêu cầu tự dịch; retry theo locale giữ tên hiện có tới khi thành công.
- [x] API mới dùng quyền category view/manage, trả 404 cho category không tồn tại và validate locale/input rõ ràng. Không ghi bản dịch riêng cho vi qua API target: tên Việt vẫn sửa qua API tên nguồn.
- [x] Đổi tên Việt giữ bản sửa tay ở từng locale và chuyển REVIEW; sửa bản dịch một locale không thay tên/trạng thái/revision của các locale còn lại.
- [x] Retry chủ động chỉ cho phép thay bản sửa tay ở locale được chọn khi dịch thành công. Endpoint retry cũ tiếp tục nhắm en; legacy nameEn và API bản dịch en đọc/ghi cùng một dữ liệu.
- [x] Race rename/manual/retry/delete/disable và nhiều worker được kiểm chứng bằng conditional writes trên PostgreSQL thật, không chỉ kiểm hình dạng mock.
- [x] Nghiệm thu cuối luồng ba locale: nhập Việt một lần → tự dịch → sửa một locale → đổi nguồn → review → retry → bật/tắt/bật lại; bảo toàn slug, quyền, visibility và ảnh.
- [x] Chạy toàn bộ test phù hợp và các kiểm tra lint/typecheck/build; regenerate OpenAPI, ghi report phân biệt code đã kiểm chứng với provider/deploy chưa nghiệm thu.
- [x] Hướng dẫn bàn giao CMS mô tả dropdown locale + một ô sửa/trạng thái/retry; store gửi locale, cache có locale và fallback đúng. Không sửa ứng dụng CMS/store trong ticket BE này.

## Notes

Không xóa dữ liệu/cột compatibility ở lần này. Không thêm Product translation, UI i18n hoặc cơ chế dọn media. Provider/storage được fake trong test. Không cần Google key thật để hoàn thành kiểm chứng BE; nghiệm thu credential thực tế là bước rollout riêng.

## Báo cáo

Đã hoàn tất triển khai và kiểm chứng cục bộ; xem [báo cáo ticket 03](03-editorial-translations-per-locale-report.md). Không tạo PR/push; task cha vẫn in-progress.
