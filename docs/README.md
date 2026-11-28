# Tài liệu dự án

Cấu trúc thư mục theo [chuẩn tài liệu chung của workspace](agents/docs-structure.md).

## Thứ tự đọc

1. [`business/`](business/) — yêu cầu nghiệp vụ, **nguồn ưu tiên** khi có mâu thuẫn: tầm nhìn & phạm vi, vai trò & phân quyền, user stories, quy tắc nghiệp vụ (`BR-*`), vòng đời Đơn hàng, tuân thủ pháp lý.
2. [`../GLOSSARY.md`](../GLOSSARY.md) — thuật ngữ chuẩn.
3. [`architecture/`](architecture/) — kiến trúc & thiết kế hệ thống, chia theo chủ đề và theo module.
4. [`architecture/11-database.md`](architecture/11-database.md) — thiết kế database (schema mục tiêu).
5. [`adr/`](adr/) — các quyết định khó đảo ngược.
6. [`conventions/`](conventions/) — quy ước code, API, config, lỗi/log, Prisma. Git, commit và PR ở [`CONTRIBUTING.md`](../CONTRIBUTING.md).
7. [`plan/`](plan/README.md) — plan & task (spec, plan, hướng dẫn tự code, metric, report); nơi theo dõi công việc.
8. [`testing/`](testing/strategy.md) — chiến lược kiểm thử Backend và traceability luật → kịch bản → tầng test.
9. [`agents/`](agents/) — quy trình cho agent: execution workflow, flows, issue tracker, [Shared AI Code Review](agents/code-review.md); `workspace.md` và `docs-structure.md` được sync từ workspace.
10. [`research/`](research/) — nghiên cứu và tài liệu học (pháp lý, hosting, handbook kiểm thử); chưa là yêu cầu cho tới khi plan hoặc ADR áp dụng.
11. [`archive/`](archive/) — tài liệu hết hiệu lực, chỉ để tham khảo.

## Trạng thái tài liệu

Mỗi tài liệu ghi trạng thái ở dòng đầu:

| Trạng thái          | Ý nghĩa                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Nháp**            | Đang thảo luận, có thể đổi bất kỳ lúc nào.                                                |
| **Đã chốt cho MVP** | Đã review; thay đổi phải cập nhật tài liệu (và ADR nếu khó đảo ngược) trước khi sửa code. |
| **Thay thế**        | Không còn hiệu lực; ghi rõ tài liệu thay thế.                                             |

Trong nội dung, **[Giả định · kiểm chứng: …]** đánh dấu điều chưa được xác minh, kèm cách xác minh; **[Cần xác minh trước go-live]** là điều không chặn việc code nhưng phải xong trước khi mở bán thật.

Trạng thái implement thực tế theo dõi trong [`plan/`](plan/README.md), không ghi trong các tài liệu khác.

## Khác biệt của repo này

- [`openapi/openapi.json`](openapi/openapi.json) là API Contract. Workflow tag Contract Version đọc đúng đường dẫn này; không di chuyển.
- `business/` là nguồn ưu tiên khi mâu thuẫn với `architecture/`, `adr/` hoặc `conventions/`.
- `architecture/` đánh số theo chủ đề (`01-`…`11-`) và có `modules/<module>.md` cho từng module.
- `agents/` có thư mục con `flows/` (flow dùng chung `feature`, `ship`) và `workflows/` (adapter theo nền tảng); xem ADR 0014.
- Ticket có thêm `guide.md` (hướng dẫn tự code); Initiative trong `plan/initiatives/` có thể có `research/` và `assets/` riêng.
