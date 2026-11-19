---
status: done
pr:
blocked-by: []
---

# Chuyển bản dịch Anh sang mô hình theo locale

Parent: [Hoàn thiện hợp đồng category cho CMS và store](../spec.md)
Plan: [Giai đoạn B — mở rộng đa ngôn ngữ](../plan.md)
Readiness: ready-for-agent

## What to build

Admin và store tiếp tục tạo, đọc, sửa và tự dịch category Việt/Anh sau khi chuyển bản dịch Anh sang dữ liệu theo locale. Dữ liệu và API hiện có vẫn dùng được, không phải nhập lại bản dịch.

## Blocked by

Không có blocker ticket; dùng baseline Giai đoạn A hiện có.

## Acceptance criteria

- [x] Migration additive chuyển tên Anh và trạng thái hiện có sang bản dịch en duy nhất theo categoryId + locale; giữ bản sửa tay, REVIEW, FAILED và dữ liệu chưa dịch. Không sửa migration cũ hoặc drop cột cũ trong ticket này.
- [x] Giữ id/slug/tên Việt/parent/order/visibility/media; category name Việt là nguồn. Có version nguồn và revision/lease từng bản dịch để ngăn kết quả cũ ghi đè.
- [x] Create/update/read/retry Việt/Anh hiện có và worker đều dùng bảng bản dịch mới; nameEn và translationStatus cũ là projection/adapter tương thích, không có hai nguồn dữ liệu hoạt động độc lập.
- [x] Worker dịch Anh vẫn chạy không chặn lưu, bảo vệ bản sửa tay và bỏ kết quả cũ sau rename/manual/retry/delete; thiếu key không mất công việc.
- [x] Migration được kiểm tra trên PostgreSQL tạm có dữ liệu Giai đoạn A cho các trạng thái; HTTP tests kiểm chứng luồng tạo/đọc/sửa/retry và contract cũ.
- [x] Unit/integration liên quan, lint, typecheck, build pass; OpenAPI và hướng dẫn rollout được cập nhật cùng thay đổi.

## Notes

Tiền đề là bản Việt/Anh Giai đoạn A đang có trong working tree, không phải trạng thái done của toàn bộ task cha (task cha còn chứa Giai đoạn B). Đối chiếu và giữ các chỉnh sửa có sẵn; cố định baseline trước khi triển khai ticket. Khi rollout phải dừng worker cũ trước migration/chạy worker mới; không cho bản BE cũ tiếp tục ghi cột legacy. Việc gỡ cột/API cũ nằm ngoài ticket và chờ consumers chuyển xong.

## Báo cáo

Đã hoàn tất và kiểm chứng local theo workflow integration được cho phép; không tạo PR/push. Xem [báo cáo ticket 01](01-locale-translation-compatibility-report.md). Task cha vẫn in-progress.
