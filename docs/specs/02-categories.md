---
status: Verified
owner: Backend
last_verified: 2026-09-23
dependencies: [CONTEXT.md, adr/0001-category-delete-restrict.md]
supersedes: docs/superpowers/categories-module-plan.md
verification: [src/modules/categories, test/categories.e2e-spec.ts]
---

# 02 — Categories module specification

## Scope

Public list/detail và protected create/update/delete cho catalog taxonomy.

## Authorization

- Read: public.
- Write: `STORE_MANAGER` hoặc `MASTER_ADMIN`.

## Invariants

- Name/slug uniqueness do PostgreSQL bảo vệ; race được map thành conflict.
- Slug được chuẩn hóa ổn định từ input/name theo contract runtime.
- Không xóa Category đang được Product tham chiếu; caller phải reassign trước.
- Pagination có giới hạn và metadata nhất quán.

## Acceptance evidence

DTO validation, service behavior, RBAC, public reads, conflict/not-found và database constraints được phủ bởi unit/E2E hiện hành.
