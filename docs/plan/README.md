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
- Task chỉ viết đầy đủ khi bắt đầu (task trước đã merge); trước đó chỉ có khung `spec.md`.
- Việc mới phát sinh: tạo thư mục task mới với `spec.md` khung, thêm dòng vào bảng.

## Task

Plan tổng: [realign-identity-catalog.md](./realign-identity-catalog.md)

| #   | Task                                                                               | Status | Blocked by                | PR  |
| --- | ---------------------------------------------------------------------------------- | ------ | ------------------------- | --- |
| 01  | [Mô hình bốn vai trò](./tasks/01-rename-roles/spec.md)                             | todo   | —                         |     |
| 02  | [Login trả role, Staff, CLI create-admin](./tasks/02-login-role-staff-cli/spec.md) | todo   | 01-rename-roles           |     |
| 03  | [Trạng thái sản phẩm & archive](./tasks/03-product-status-archive/spec.md)         | todo   | 02-login-role-staff-cli   |     |
| 04  | [Size/màu & quy tắc biến thể](./tasks/04-sizes-colors-variants/spec.md)            | todo   | 03-product-status-archive |     |
| 05  | [Danh mục nhiều cấp](./tasks/05-nested-categories/spec.md)                         | todo   | 04-sizes-colors-variants  |     |
