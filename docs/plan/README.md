# Plan & task

Nơi theo dõi công việc của dự án (thay cho GitHub Issues).

## Cấu trúc

```
docs/plan/
├── README.md                     ← file này: bảng tổng task
├── <plan-tổng>.md                ← plan nhiều task, vd realign-identity-catalog.md
└── tasks/<NN>-<kebab-name>/
    ├── spec.md    ← trước khi code: mục tiêu, phạm vi, AC; frontmatter status/pr/blocked-by
    ├── plan.md    ← trước khi code: các bước, branch, rủi ro
    ├── guide.md   ← trước khi code: hướng dẫn tự viết code (chỗ sửa, gợi ý, test, bẫy) — không phải code hoàn chỉnh
    ├── metric.md  ← số đo trước → sau
    └── report.md  ← sau khi merge: đã làm, lệch spec, bài học
```

Quy ước:

- `NN` là thứ tự làm. Tên thư mục kebab-case tiếng Anh.
- `status` trong frontmatter của `spec.md`: `todo` | `in-progress` | `done`. Cập nhật bảng dưới cùng lúc.
- Task chỉ viết đầy đủ khi bắt đầu (task trước đã merge); trước đó chỉ có khung `spec.md`. Ngoại lệ: chuỗi task sinh ra từ một lần grill/architecture review (vd. 07–08) được viết đủ cùng lúc để giữ quyết định; khi bắt đầu từng task phải đối chiếu lại với code.
- Việc mới phát sinh: tạo thư mục task mới với `spec.md` khung, thêm dòng vào bảng.
- `metric.md` ghi token **đo thật** (không ước lượng), chia theo code / test / docs / explore: `npm run tokens -- <sessionId|latest> [--since <ISO>] [--until <ISO>] --md` (`scripts/token-usage.ts`, đọc transcript Claude Code ở `~/.claude/projects/`; chỉ phân loại được file ghi qua Write/Edit — sửa bằng Bash bị tính vào `explore/chat`).

## Task

Plan tổng: [realign-identity-catalog.md](./realign-identity-catalog.md)

| #   | Task                                                                                    | Status      | Blocked by                | PR  |
| --- | --------------------------------------------------------------------------------------- | ----------- | ------------------------- | --- |
| 01  | [Mô hình bốn vai trò](./tasks/01-rename-roles/spec.md)                                  | done        | —                         | #60 |
| 02  | [Login trả role, Staff, CLI create-admin](./tasks/02-login-role-staff-cli/spec.md)      | done        | 01-rename-roles           | #60 |
| 03  | [Trạng thái sản phẩm & archive](./tasks/03-product-status-archive/spec.md)              | done        | 02-login-role-staff-cli   | #60 |
| 04  | [Size/màu & quy tắc biến thể](./tasks/04-sizes-colors-variants/spec.md)                 | done        | 03-product-status-archive | #60 |
| 05  | [Danh mục nhiều cấp](./tasks/05-nested-categories/spec.md)                              | done        | 04-sizes-colors-variants  | #60 |
| 06  | [Gộp catalog thành một module](./tasks/06-catalog-module/spec.md)                       | done        | —                         | #63 |
| 07  | [Gộp `auth` + `staff` thành module identity](./tasks/07-identity-module/spec.md)        | done        | 06                        | #65 |
| 08  | [Tách `AuthService` theo use case](./tasks/08-identity-use-case-services/spec.md)       | in-progress | 07                        |     |
| 09  | [Cổng phân quyền `@Authorize` ở `common/auth/`](./tasks/09-authorize-decorator/spec.md) | done        | —                         | #67 |
| 10  | [Gom hạ tầng vào `infrastructure/`](./tasks/10-infrastructure-folder/spec.md)           | done        | 09                        | #68 |
| 11  | [Deploy backend miễn phí (Render + Neon)](./tasks/11-deploy-render-free/spec.md)        | todo        | —                         |     |
| 12  | [`identity/` theo layout phẳng](./tasks/12-identity-subfolders/spec.md)                 | todo        | 08                        |     |
| 13  | [`catalog/` theo layout phẳng](./tasks/13-catalog-subfolders/spec.md)                   | done        | —                         | #75 |
