---
status: todo
pr:
blocked-by:
  - 45-migrate-cart
  - 46-migrate-checkout
  - 48-migrate-identity-auth
---

# Hoàn tất chuyển đổi kiến trúc

**Blocked by:** 45-migrate-cart, 46-migrate-checkout, 48-migrate-identity-auth

**Status:** ready-for-agent

**What to build:** Dọn phần chuyển tiếp sau khi mọi module đã chuyển đổi, để rule và tài liệu chỉ còn mô tả một kiến trúc.

**Quyết định nguồn:** [Bộ tài liệu chuẩn cho toàn src](../../wayfinding/src-wide-architecture-standard/issues/01-canonical-standard-documents.md) (mục Bổ sung về rule agent), [Bộ luật lint bắt buộc và lộ trình bật](../../wayfinding/src-wide-architecture-standard/issues/08-lint-boundary-rules.md).

## Đọc trước khi làm (bắt buộc với mọi agent: Claude Code, Codex, Copilot)

1. Rule kiến trúc: [`.claude/rules/module-architecture.md`](../../../../.claude/rules/module-architecture.md) và quyết định [ADR 0015](../../../adr/0015-one-layered-architecture-for-every-module.md).
2. Map quyết định: [Chuẩn kiến trúc thống nhất cho toàn `src/modules`](../../wayfinding/src-wide-architecture-standard/map.md) và các ticket được link trong spec này. Ticket là nguồn quyết định; spec này không được mâu thuẫn với ticket.
3. **Đối chiếu code hiện tại trước khi sửa.** Nếu code khác với mô tả trong spec (file đã đổi tên, đã có người làm một phần...), dừng lại và hỏi người dùng, không tự suy diễn.
4. Quy trình Git của repo: branch từ `dev`, Conventional Commit, PR vào `dev`, squash merge. **Không** ghi attribution AI/agent trong commit hay PR.

## Việc cần làm

1. Kiểm danh sách module đã chuyển đổi trong script lint và mục **Migrated modules** của rule đủ cả 6 module (catalog, identity, voucher, cart, inventory, checkout); đổi script để mặc định áp luật cho **mọi** module trong `src/modules/` (module mới tự được bảo vệ).
2. Danh sách tạm `max-lines` phải rỗng; xoá cơ chế danh sách tạm khỏi script.
3. Gỡ mục Migration status và các câu chuyển tiếp ("In modules covered by module architecture ...") trong `.claude/rules/module-architecture.md`, `coding-style.md`, `error-logging.md`, `api-conventions.md`, `prisma-schema.md`; xoá các câu cũ đã lỗi thời ("Do not add a Repository layer", "throw `NotFoundException` in the service", "inject `PrismaService` in the service"...). Chạy `npm run agents:check`.
4. Rà `docs/convention/` và `docs/architecture/` lần cuối: không còn mô tả kiểu cũ (service gọi Prisma, `services/admin`, truyền `tx`).
5. `grep -rnE "PrismaService|#src/generated" src/modules | grep -v /infrastructure/` → rỗng; `grep -rn "throw new [A-Za-z]*Exception" src/modules` chỉ còn trong `admin/`, `storefront/`, `presentation/`.

## Tiêu chí nghiệm thu

- [ ] `npm run build`, `typecheck`, `lint`, `lint:boundaries:check`, `test`, `test:e2e`, `agents:check` đạt; Swagger diff rỗng.
- [ ] Hai lệnh grep ở trên cho kết quả đúng.
- [ ] Map [Chuẩn kiến trúc thống nhất cho toàn `src/modules`](../../wayfinding/src-wide-architecture-standard/map.md) được ghi chú "đã triển khai xong" kèm PR.
