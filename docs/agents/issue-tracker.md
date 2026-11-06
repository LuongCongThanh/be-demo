# Issue tracker: local Markdown (`docs/plan/`)

Công việc của repo được theo dõi bằng file Markdown trong [`docs/plan/`](../plan/README.md). **Không** dùng GitHub Issues.

## Conventions

- **Tạo task**: tạo thư mục `docs/plan/tasks/<NN>-<kebab-name>/` với `spec.md` (frontmatter `status: todo`, `pr:`, `blocked-by: []`), thêm một dòng vào bảng trong `docs/plan/README.md`.
- **Đọc task**: đọc `spec.md`, `plan.md`, `guide.md`, `metric.md`, `report.md` trong thư mục task.
- **Liệt kê task**: bảng trong `docs/plan/README.md`, hoặc `grep -l "status: todo" docs/plan/tasks/*/spec.md`.
- **Cập nhật trạng thái**: sửa `status` trong frontmatter `spec.md` và cột Status trong bảng tổng cùng lúc.
- **Đóng task**: `status: done`, ghi `pr: #NN`, viết `report.md`.
- **Phụ thuộc**: `blocked-by` trong frontmatter (tên thư mục task). Task chỉ được làm khi mọi task chặn nó đã `done`.

Các file trong một task: xem [`docs/plan/README.md`](../plan/README.md#cấu-trúc).

## When a skill says "publish to the issue tracker"

Tạo thư mục task mới trong `docs/plan/tasks/` như trên.

## When a skill says "fetch the relevant ticket"

Đọc thư mục task tương ứng trong `docs/plan/tasks/`.

## Pull requests as a triage surface

**No.**
