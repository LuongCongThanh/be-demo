---
description: Chạy trọn vòng lặp trước khi mở PR — verify, rebase, code-review, push, tạo PR (theo docs/convention/git-workflow.md / .claude/rules/git-workflow.md)
---

Chạy tuần tự các bước sau, dừng lại và báo cáo ngay nếu bước nào fail — không tự ý bỏ qua hoặc "sửa cho qua" bằng cách nới lỏng convention:

1. **Verify branch**: `git status` + `git rev-parse --abbrev-ref HEAD`. Nếu đang ở `main`/`dev` → dừng, báo lỗi (không tạo branch giùm nếu user chưa xác nhận tên branch).
2. **Definition of Done — chạy trước khi rebase**: `pnpm lint`, `pnpm typecheck`, `pnpm test`, và `pnpm test:e2e` (nếu branch có thay đổi liên quan e2e). Fail bước nào → dừng, báo lỗi, không tiếp tục.
3. **Code review**: invoke skill `code-review` trên diff so với `dev` ở effort level mặc định (hoặc level user chỉ định trong `$ARGUMENTS`). Có finding mức nghiêm trọng → dừng, báo cáo, để user quyết định sửa hay bỏ qua trước khi đi tiếp.
4. **Rebase lên `dev`**: `git fetch origin dev && git rebase origin/dev`. Có conflict → dừng, để user tự giải quyết (không tự `--theirs`/`--ours`).
5. **Push**: nếu branch đã từng push lên remote → `git push --force-with-lease` (không dùng `--force`); nếu chưa từng push → `git push -u origin <branch>`.
6. **Tạo PR**: `gh pr create` vào `dev`, base squash-merge. Dùng nội dung theo mẫu PR trong hướng dẫn tạo PR chuẩn của repo (Summary + Test plan).
7. **Sau khi PR merge** (user báo đã merge, hoặc `gh pr view --json state` = MERGED): nhắc/gọi skill `finishing-a-development-branch` để xoá branch local + remote theo đúng flow đã merge (squash vào `dev`).

Ghi chú:

- Không skip bước 2/3 dù user đang vội — đây là lý do `/ship` tồn tại, thay vì gõ tay từng lệnh git.
- Code review (bước 3) chạy trước rebase (bước 4) để tránh phải rebase lại nếu review yêu cầu sửa code — đúng tinh thần "bắt lỗi sớm" của `.claude/rules/git-workflow.md`.
- `$ARGUMENTS` (nếu có) là effort level cho code-review (`low`/`medium`/`high`/`xhigh`/`max`), mặc định dùng effort level đã dùng lần gần nhất của skill `code-review`.
