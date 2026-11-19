# Ticket BE — Giai đoạn B của category

Các ticket này là phần việc con của task category, không phải task được đánh số riêng. Trạng thái dùng todo/in-progress/done theo tracker BE; readiness không thay thế trạng thái. blocked-by trong frontmatter dùng tên file cùng thư mục (không có .md). Chỉ bắt đầu khi các blocker đã done; cập nhật trạng thái file và bảng chỉ mục cùng lúc. Đóng ticket theo quy ước report/PR của repo, không tự đóng task cha.

| Ticket                                                                                 | Status | Blocked by                                   |
| -------------------------------------------------------------------------------------- | ------ | -------------------------------------------- |
| [Chuyển bản dịch Anh sang mô hình theo locale](01-locale-translation-compatibility.md) | done   | —; baseline Giai đoạn A hiện có              |
| [Bật/tắt ngôn ngữ và tự dịch category](02-language-enablement-backfill.md)             | todo   | Chuyển bản dịch Anh sang mô hình theo locale |
| [Sửa tay và retry bản dịch theo ngôn ngữ](03-editorial-translations-per-locale.md)     | todo   | Bật/tắt ngôn ngữ và tự dịch category         |

Mỗi ticket là một hành vi BE có thể kiểm chứng, gồm migration/service/API/worker liên quan, test và contract; không chia ticket chỉ để dựng một tầng. Các kiểm tra tổng hợp và bàn giao nằm trong ticket cuối, còn từng ticket phải có kiểm chứng riêng.
