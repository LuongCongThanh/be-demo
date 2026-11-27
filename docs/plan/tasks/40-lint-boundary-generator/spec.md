---
status: done
pr: #143
blocked-by:
  - 39-shared-architecture-foundations
---

# Script sinh luật lint ranh giới

**Blocked by:** 39-shared-architecture-foundations

**Status:** ready-for-agent

**What to build:** Script sinh cấu hình oxlint chặn import sai ranh giới, bước kiểm tra trong CI, luật `max-lines` và cấm import tương đối. Lúc này **chưa có module nào trong danh sách đã chuyển đổi**, nên luật tầng/ranh giới chưa áp cho module nào.

**Quyết định nguồn:** [Bộ luật lint bắt buộc và lộ trình bật](../../wayfinding/src-wide-architecture-standard/issues/08-lint-boundary-rules.md), [Khả năng của oxlint để chặn import sai ranh giới](../../wayfinding/src-wide-architecture-standard/issues/04-oxlint-boundary-capability.md) (đọc cả file research trên branch `docs/research-oxlint-boundary-capability` nếu cần config mẫu).

## Đọc trước khi làm (bắt buộc với mọi agent: Claude Code, Codex, Copilot)

1. Rule kiến trúc: [`.claude/rules/module-architecture.md`](../../../../.claude/rules/module-architecture.md) và quyết định [ADR 0015](../../../adr/0015-one-layered-architecture-for-every-module.md).
2. Map quyết định: [Chuẩn kiến trúc thống nhất cho toàn `src/modules`](../../wayfinding/src-wide-architecture-standard/map.md) và các ticket được link trong spec này. Ticket là nguồn quyết định; spec này không được mâu thuẫn với ticket.
3. **Đối chiếu code hiện tại trước khi sửa.** Nếu code khác với mô tả trong spec (file đã đổi tên, đã có người làm một phần...), dừng lại và hỏi người dùng, không tự suy diễn.
4. Quy trình Git của repo: branch từ `dev`, Conventional Commit, PR vào `dev`, squash merge. **Không** ghi attribution AI/agent trong commit hay PR.

## Việc cần làm

1. `scripts/generate-oxlint-boundaries.ts` (chạy bằng `tsx`), thêm npm script `lint:boundaries` (ghi `oxlint.json`) và `lint:boundaries:check` (so sánh, exit 1 nếu khác).
2. Đầu vào trong script: danh sách module đã chuyển đổi (khởi đầu rỗng), danh sách feature của module nhiều feature (`catalog`: category, product, product-option, pricing; `identity`: auth, access, internal-account), danh sách tạm `max-lines` (13 file trong ticket [Chia việc triển khai thành task](../../wayfinding/src-wide-architecture-standard/issues/09-implementation-task-breakdown.md)).
3. Script sinh override cho từng nhóm file, **mỗi override mang đủ bộ luật áp cho nhóm đó** (override thay thế, không gộp; override khớp sau cùng thắng). Luôn giữ luật permissions top-level hiện có; xử lý override `off` của `src/security/authorization/**` để không tắt luật mới ngoài ý muốn.
4. 7 luật (chỉ áp luật 1–6 cho module trong danh sách đã chuyển đổi):
   1. `**/domain/**` cấm `@nestjs/**`, `#src/infrastructure/**`, `#src/generated/**` (dùng `**`, không dùng `*`).
   2. `**/application/**` cấm `#src/generated/**`, `#src/infrastructure/database/prisma.service.js`, `nestjs-cls`, `@nestjs-cls/**`, adapter trong `infrastructure/`; cho phép `#src/infrastructure/**/*.port.js`.
   3. `**/domain/**`, `**/application/**` cấm `importNames` các HTTP exception của `@nestjs/common` (`NotFoundException`, `ConflictException`, `BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `UnprocessableEntityException`, `HttpException`). Nếu oxlint không hỗ trợ `importNames` kèm pattern như mong muốn thì ghi rõ trong `report.md` và dùng cách thay thế rẻ nhất (grep trong CI).
   4. `**/admin/**`, `**/storefront/**`, `**/presentation/**` cấm `PrismaService`, `#src/generated/**`.
   5. `src/modules/<a>/**` cấm `#src/modules/*/**` trừ chính `<a>`, `#src/modules/<b>/<b>.module.js` và `#src/modules/<b>/application/<b>.service.js` của từng module khác (liệt kê tường minh theo tên module, không dùng regex lookahead).
   6. Feature X trong cùng module cấm import feature Y trừ `domain/`, `presentation/` và đúng file `application/<y>.service.js`.
   7. `max-lines` 200, `skipBlankLines`, `skipComments`; bỏ qua `src/generated/**`, `**/*.spec.ts`, `**/*.e2e-spec.ts` và file trong danh sách tạm. Cấm import tương đối (`./**`, `../**`) trong `src/**` trừ `src/generated/**`.
5. Thêm `npm run lint:boundaries:check` vào job lint của `.github/workflows/ci.yml`.
6. Viết probe nhỏ (fixture trong thư mục test của script, không trong `src/`) chứng minh mỗi luật bắt đúng một vi phạm và không bắt import hợp lệ.

## Tiêu chí nghiệm thu

- [ ] `npm run lint` đạt trên code hiện tại (vì chưa module nào trong danh sách).
- [ ] `npm run lint:boundaries:check` đạt; sửa tay `oxlint.json` làm nó fail.
- [ ] Probe chứng minh 7 luật hoạt động, gồm cả trường hợp file khớp nhiều nhóm.
- [ ] Đưa một module vào danh sách thử nghiệm cục bộ (không commit) cho thấy luật bắt được vi phạm thật, ghi kết quả vào `report.md`.
- [ ] Cập nhật `.claude/rules/module-architecture.md` mục Lint (script đã tồn tại); `npm run agents:check` đạt.
