---
status: done
pr: #PRNUM
blocked-by: [08-identity-use-case-services]
labels: [ready-for-agent]
---

# Spec 12: `identity/` theo layout phẳng — `auth/` + `internal-account/`

Branch: `chore/identity-subfolders` · Slice 0 của tái cấu trúc ba repo (spec cha nằm ở workspace, ngoài repo).

## Problem Statement

`modules/identity/` vẫn chia theo vai trò file (`controllers/ services/ dto/ guards/ strategies/`), trái với layout đã chốt ở `docs/architecture/02-modules.md` và `coding-style-conventions.md §2` (#73): file nhóm theo thực thể, một thư mục `dto/` cho mỗi nhóm. `staff.service.ts` và `internal-account.service.ts` là hai service cho cùng một khái niệm Tài khoản nội bộ.

## Solution

Thuần di chuyển + gộp, không đổi hành vi:

- `identity/auth/`: `auth.controller.ts`, `me.controller.ts`, các service use case sinh ra từ task 08, `token.service.ts`, `password.service.ts`, `jwt.strategy.ts`, `email-throttler.guard.ts`, `dto/` (← `dto/auth/*`).
- `identity/internal-account/`: `admin-staff.controller.ts`, `internal-account.service.ts` (gộp `staff.service.ts`, giữ bất biến "luôn còn ≥ 1 Admin active"), `dto/` (← `dto/staff/*`).
- `identity.module.ts` giữ ở gốc module, `exports` không đổi (ngoài việc bỏ `StaffService` nếu nó chỉ còn là alias).
- Xoá các thư mục cũ rỗng `controllers/ services/ dto/ guards/ strategies/`.
- `identity/access/` **không** thuộc task này (slice A).

## Acceptance criteria

- Route, Swagger và response không đổi: diff `jq -S` của Swagger trước/sau rỗng (như task 06, 07).
- `typecheck`, `lint`, `build` pass. Test cũ chỉ được sửa đường dẫn import / gộp file spec theo service, không sửa assertion; không viết test mới (test viết ở Phase 7).
- Không còn import tới đường dẫn cũ (`grep -r "identity/(controllers|services|dto|guards|strategies)" src test` rỗng).
