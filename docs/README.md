# Tài liệu dự án

## Thứ tự đọc

1. [`business/`](./business/) — yêu cầu nghiệp vụ, **nguồn ưu tiên** khi có mâu thuẫn: tầm nhìn & phạm vi, vai trò & phân quyền, user stories, quy tắc nghiệp vụ (`BR-*`), vòng đời Đơn hàng, tuân thủ pháp lý.
2. [`../GLOSSARY.md`](../GLOSSARY.md) — thuật ngữ chuẩn.
3. [`architecture/`](./architecture/) — kiến trúc & thiết kế hệ thống, chia theo chủ đề và theo module.
4. [`architecture/11-database.md`](./architecture/11-database.md) — thiết kế database (schema mục tiêu).
5. [`adr/`](./adr/) — các quyết định khó đảo ngược.
6. [`convention/`](./convention/) — quy ước code, API, config, lỗi/log, Prisma, git.

## Trạng thái tài liệu

Mỗi tài liệu ghi trạng thái ở dòng đầu:

| Trạng thái          | Ý nghĩa                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Nháp**            | Đang thảo luận, có thể đổi bất kỳ lúc nào.                                                |
| **Đã chốt cho MVP** | Đã review; thay đổi phải cập nhật tài liệu (và ADR nếu khó đảo ngược) trước khi sửa code. |
| **Thay thế**        | Không còn hiệu lực; ghi rõ tài liệu thay thế.                                             |

Trong nội dung, **[Giả định · kiểm chứng: …]** đánh dấu điều chưa được xác minh, kèm cách xác minh; **[Cần xác minh trước go-live]** là điều không chặn việc code nhưng phải xong trước khi mở bán thật.

Trạng thái implement thực tế theo dõi trên GitHub Issues, không ghi trong tài liệu.
