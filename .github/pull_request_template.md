<!--
Tiêu đề PR = commit message khi Squash and Merge → theo Conventional Commits:
  <type>(<scope>): <mô tả ngắn, tiếng Anh, chữ thường, không dấu chấm cuối>
  type: feat | fix | refactor | test | docs | chore | style | perf | ci | build | revert
  scope: tên module (identity, catalog, ordering, payments, …) hoặc ci, deps, docs
  Ví dụ: feat(ordering): add checkout quote endpoint
-->

## Tóm tắt

<!-- Thay đổi gì và vì sao. 1–3 gạch đầu dòng. -->

-

## Liên kết

Closes #
<!-- Tài liệu liên quan: BR-*, US-*, ADR, docs/architecture/modules/<module>.md -->

## Loại thay đổi

- [ ] feat — tính năng mới
- [ ] fix — sửa lỗi
- [ ] refactor / perf — không đổi hành vi
- [ ] docs / test / chore / ci

## Ảnh hưởng

- [ ] Có migration Prisma (đã kiểm tra an toàn với dữ liệu thật — `docs/convention/prisma-conventions.md`)
- [ ] Đổi hợp đồng API (request/response/mã lỗi) — đã cập nhật Swagger & Postman (`npm run postman:sync`)
- [ ] Thêm/đổi biến môi trường — đã cập nhật `.env.example` và `src/config/env.validation.ts`
- [ ] Breaking change — mô tả bên dưới

## Cách kiểm tra

<!-- Lệnh đã chạy, kịch bản đã thử, ảnh chụp Swagger nếu có. -->

## Checklist (Definition of Done — `docs/convention/api-rules.md`)

- [ ] Branch tách từ `dev`, đã rebase lên `dev` mới nhất
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` đều qua
- [ ] Có test cho hành vi mới / lỗi đã sửa
- [ ] Đã chạy `/code-review` trên diff
- [ ] Tài liệu liên quan đã cập nhật (business/architecture/ADR/GLOSSARY nếu đổi thuật ngữ)
- [ ] Không có secret, PII trong code/log; không có AI attribution trong commit
