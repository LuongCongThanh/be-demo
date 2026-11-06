---
status: done
pr: #68
blocked-by: [09-authorize-decorator]
labels: [ready-for-agent]
---

# Spec 10: Gom hạ tầng vào `src/infrastructure/`

Branch: `chore/infrastructure-folder` · Nguồn: [architecture review 2026-11-06, đề xuất #4](../../../architecture/reviews/architecture-review-2026-11-06.html)

## Problem Statement

Nhìn `src/` không phân biệt được đâu là nghiệp vụ, đâu là hạ tầng: `prisma/`, `health/`, `metrics/`, `mail/`, `audit/` nằm phẳng cạnh `modules/`, `config/`, `common/`. `02-modules §4` đã vẽ cây đích có `infrastructure/` nhưng code chưa theo. Theo docs, `mail` thuộc module `notifications` và `audit` thuộc `admin-config` — hai module chưa tồn tại, nên tạo module rỗng bây giờ là YAGNI.

## Solution

Tạo `src/infrastructure/` và chuyển hạ tầng vào: `database/` (Prisma), `observability/` (health + metrics + logging), tạm thời `mail/` và `audit/`. **Thuần di chuyển**: không đổi interface, route, Swagger, response hay hành vi. Sau task này `src/` gốc chỉ còn `main.ts`, `cli.ts`, `app.module.ts`, `config/`, `common/`, `bootstrap/`, `cli/`, `generated/`, `infrastructure/`, `modules/`.

## User Stories

1. Là dev mới, tôi muốn nhìn `src/` là biết ngay nghiệp vụ nằm ở `modules/` và hạ tầng ở `infrastructure/`, để định vị code nhanh.
2. Là dev, tôi muốn `PrismaModule`/`PrismaService` nằm ở `infrastructure/database/`, để đúng cây đích trong `02-modules §4`.
3. Là dev vận hành, tôi muốn health check, metrics và logging nằm chung `infrastructure/observability/`, để mọi thứ liên quan quan sát hệ thống ở một chỗ.
4. Là dev, tôi muốn `AppLogger` và request-context (`AsyncLocalStorage`) chuyển từ `common/logging/` sang `infrastructure/observability/logging/`, để `common/` chỉ còn tiện ích thuần không phụ thuộc runtime.
5. Là dev, tôi muốn `mail/` và `audit/` tạm ở `infrastructure/`, để không phải tạo module `notifications`/`admin-config` rỗng.
6. Là dev sau này làm `notifications`/`admin-config`, tôi muốn có ghi chú rõ đích đến của `mail`/`audit`, để biết chuyển chúng khi nào và về đâu.
7. Là người gọi API, tôi muốn `/health`, `/metrics` và mọi route khác trả đúng như trước, để refactor không ảnh hưởng client hay giám sát.
8. Là người vận hành, tôi muốn tên metric, log format và request-id không đổi, để dashboard và truy vết log không gãy.
9. Là dev, tôi muốn mọi import vẫn dùng alias `#src/*` (không relative, không barrel), để giữ convention coding-style.
10. Là reviewer, tôi muốn PR chỉ gồm di chuyển file + sửa import, để review bằng cách xác nhận "không có thay đổi logic".
11. Là maintainer, tôi muốn `02-modules §4` phần "Hiện tại" khớp cây mới, để tài liệu không lệch.
12. Là maintainer, tôi muốn các doc convention trỏ đường dẫn cũ (vd. error-handling nhắc `common/app-logger`, prisma-conventions nhắc `prisma.service`) được cập nhật, để link không chết.
13. Là dev chạy CLI, tôi muốn `create-admin` vẫn hoạt động, để không ảnh hưởng quy trình tạo Admin.

## Implementation Decisions

- Cây đích:
  - `infrastructure/database/` ← `prisma/`
  - `infrastructure/observability/health/` ← `health/`
  - `infrastructure/observability/metrics/` ← `metrics/`
  - `infrastructure/observability/logging/` ← `common/logging/` (`app-logger`, `request-context`)
  - `infrastructure/mail/` ← `mail/` (đích cuối: `modules/notifications`)
  - `infrastructure/audit/` ← `audit/` (đích cuối: `modules/admin-config`)
- Giữ nguyên tên class Nest module/service (`PrismaModule`, `HealthModule`, `MetricsModule`, `MailModule`, `AuditModule`) — chỉ đổi đường dẫn. Không tạo module gộp `ObservabilityModule` (sẽ đổi interface; không cần).
- `bootstrap/`, `cli/`, `config/`, `common/` (filters, middleware, pagination, swagger, utils, auth, validation) giữ ở gốc `src/`.
- Một commit thuần `git mv` trước, commit sau sửa import, để `git log --follow` giữ lịch sử.
- `docs/convention/*` và `docs/architecture/*` cập nhật đường dẫn trong cùng PR.

## Testing Decisions

- Không thêm test: thay đổi thuần vị trí, interface không đổi (review đã nêu "test không đổi").
- Seam duy nhất là bộ test hiện có: `lint`, `typecheck`, `test`, `test:e2e` (đặc biệt `health.e2e-spec`, `metrics.e2e-spec`, `mail-smtp.e2e-spec`, `cli-create-admin.e2e-spec`) xanh **không sửa assertion** — chỉ sửa đường dẫn import trong test.
- Swagger `jq -S` diff trước/sau rỗng (prior art: task 06).
- Kiểm `grep -rn "#src/\(prisma\|health\|metrics\|mail\|audit\|common/logging\)/" src test` trả rỗng.

## Out of Scope

- Tạo module `notifications`, `admin-config`; đổi interface `MailService`/`AuditLogService`.
- Gộp health/metrics thành một Nest module.
- Bất kỳ thay đổi phân quyền nào (task 09).

## Further Notes

- Blocked by 09 chỉ để tránh xung đột import hàng loạt khi hai PR cùng sửa nhiều file; về logic hai task độc lập.
- Lợi ích thấp hơn #1–#3 (thuần locality); có thể làm cuối.
