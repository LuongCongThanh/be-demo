# Issue tracker: local Markdown (`docs/plan/`)

Công việc của repo được theo dõi bằng file Markdown trong [`docs/plan/`](../plan/README.md). **Không** dùng GitHub Issues.

## Conventions

- **Tạo task**: tạo thư mục `docs/plan/tasks/todo/<NN>-<kebab-name>/` với `spec.md` (frontmatter `status: todo`, `pr:`, `blocked-by: []`), thêm một dòng vào bảng trong `docs/plan/README.md`.
- **Vị trí theo tình trạng**: `tasks/todo/` cho task chưa hoàn tất (`todo`, `in-progress`), `tasks/done/` cho task đã hợp nhất, `tasks/wontfix/` cho task đã quyết định không làm (ghi lý do trong `spec.md`). Thư mục chỉ để điều hướng; `status` trong frontmatter vẫn là nguồn chuẩn.
- **Đọc task**: đọc `spec.md`, `plan.md`, `guide.md`, `metric.md`, `report.md` trong thư mục task.
- **Liệt kê task**: bảng trong `docs/plan/README.md`, hoặc `grep -l "status: todo" docs/plan/tasks/todo/*/spec.md`.
- **Cập nhật trạng thái**: sửa `status` trong frontmatter `spec.md` và cột Status trong bảng tổng cùng lúc.
- **Đóng task**: `status: done`, ghi `pr: #NN`, viết `report.md`, rồi `git mv` cả thư mục từ `tasks/todo/` sang `tasks/done/` và sửa các link trỏ tới nó.
- **Phụ thuộc**: `blocked-by` trong frontmatter (tên thư mục task, không kèm `todo/`/`done/`; tìm trong cả ba nhóm). Task chỉ được làm khi mọi task chặn nó đã `done`.

Các file trong một task: xem [`docs/plan/README.md`](../plan/README.md#cấu-trúc).

## When a skill says "publish to the issue tracker"

Tạo thư mục task mới trong `docs/plan/tasks/todo/` như trên.

## When a skill says "fetch the relevant ticket"

Đọc thư mục task tương ứng trong `docs/plan/tasks/{todo,done,wontfix}/`.

## Wayfinding operations

Used by `/wayfinder`. Wayfinder maps are decision maps; their child tickets resolve decisions and are separate from implementation tasks in `docs/plan/tasks/`.

- **Map**: `docs/plan/initiatives/<effort>/map.md`.
- **Child ticket**: `docs/plan/initiatives/<effort>/issues/NN-<slug>.md`, numbered from `01`. Each ticket has `Type: research|prototype|grilling|task`, `Status: open|claimed|resolved`, and an optional `Blocked by: NN, NN` line near the top.
- **Blocking**: `Blocked by` lists child-ticket numbers. A ticket is unblocked when every listed ticket has `Status: resolved`.
- **Frontier**: the open, unblocked, unclaimed child tickets; the lowest number goes first.
- **Claim**: set `Status: claimed` and save before starting work.
- **Resolve**: append the answer under `## Answer`, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far.

## Pull requests as a triage surface

**No.**
