---
status: todo
pr:
blocked-by: []
labels: [ready-for-agent]
---

# Spec 14: Hợp đồng OpenAPI phát hành theo tag

Branch dự kiến: `chore/openapi-contract` · Slice A (RBAC) của tái cấu trúc ba repo. Không viết test mới (Phase 7); xác minh bằng typecheck, lint, build, Swagger và chạy tay. Test cũ chỉ sửa import/hằng số theo tên mới, không đổi ý nghĩa assertion.

## Problem Statement

CMS và storefront đang copy tay type API (`Api.generated.ts`). Mỗi lần API đổi, frontend phải sửa tay và không có cách biết bản nào khớp với API.

## Solution

- `scripts/write-openapi.ts` dựng document Swagger từ app (dùng `bootstrap/openapi.ts`, không cần database thật) và ghi `docs/openapi/openapi.json` (JSON ổn định, key sắp xếp). Script npm `openapi:write`.
- CI: job kiểm `docs/openapi/openapi.json` khớp với code (sinh lại rồi `git diff --exit-code`).
- Workflow phát hành: push tag `openapi-v*` → tạo GitHub Release đính kèm đúng file `docs/openapi/openapi.json` của commit đó. Frontend pin URL asset của tag qua `OPENAPI_URL`.
- Đổi tên class controller catalog sang số ít theo tên file (vd. `ProductsController` → `ProductController`) — quyết định đã duyệt: làm cùng lúc với hợp đồng OpenAPI vì đổi `operationId`. Ghi danh sách `operationId` cũ → mới trong report.

## Acceptance criteria

- `npm run openapi:write` sinh file giống hệt khi chạy lại; CI fail khi file lệch.
- Workflow release chạy được (thử bằng `workflow_dispatch` hoặc review YAML; tag thật tạo sau task 17).
- Swagger chỉ khác `operationId` của controller đã đổi tên.
