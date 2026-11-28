---
status: done
pr: #146
blocked-by:
  - 40-lint-boundary-generator
---

# Chuyển module voucher sang kiến trúc chung

**Blocked by:** 40-lint-boundary-generator

**What to build:** Chuyển module voucher sang kiến trúc chung: đưa module về bộ khung chung theo ADR 0015, giữ nguyên hành vi.

**Quyết định nguồn:** [Bản đồ chuyển đổi cho từng module](../../../wayfinding/src-wide-architecture-standard/issues/02-layered-structure-criteria.md), [Chiến lược xử lý lỗi toàn src](../../../wayfinding/src-wide-architecture-standard/issues/03-error-handling-strategy.md), [Hợp đồng transaction trong và giữa các module](../../../wayfinding/src-wide-architecture-standard/issues/05-transaction-contract.md), [Ownership dữ liệu cho cart và checkout](../../../wayfinding/src-wide-architecture-standard/issues/06-cart-checkout-ownership.md)

**Hình đích minh họa:** [cây toàn `src/modules`](../../../wayfinding/src-wide-architecture-standard/assets/02-src-modules-target-tree.md). Đây là minh họa; tên file chính xác chốt theo code lúc làm.

## Đọc trước khi làm (bắt buộc với mọi agent: Claude Code, Codex, Copilot)

1. Rule kiến trúc: [`.claude/rules/module-architecture.md`](../../../../../.claude/rules/module-architecture.md) và quyết định [ADR 0015](../../../../adr/0015-one-layered-architecture-for-every-module.md).
2. Map quyết định: [Chuẩn kiến trúc thống nhất cho toàn `src/modules`](../../../wayfinding/src-wide-architecture-standard/map.md) và các ticket được link trong spec này. Ticket là nguồn quyết định; spec này không được mâu thuẫn với ticket.
3. **Đối chiếu code hiện tại trước khi sửa.** Nếu code khác với mô tả trong spec (file đã đổi tên, đã có người làm một phần...), dừng lại và hỏi người dùng, không tự suy diễn.
4. Quy trình Git của repo: branch từ `dev`, Conventional Commit, PR vào `dev`, squash merge. **Không** ghi attribution AI/agent trong commit hay PR.

## Ràng buộc chung (refactor thuần, không đổi hành vi)

- **Không đổi** route, HTTP method, status code, response shape, message lỗi, Swagger. Không đổi schema Prisma hay migration.
- Không trộn sửa bug hay tính năng mới vào PR này. Thấy bug thì ghi vào `report.md`, không sửa.
- Mỗi file ≤ 200 dòng (không tính dòng trống, comment), mục tiêu ~150. Vượt thì tách theo trách nhiệm.
- Không tạo thư mục rỗng; không tạo interface/port/mapper khi không có nhu cầu thật.
- Không dùng barrel `index.ts`; import bằng alias `#src/...js`, không import tương đối.
- Test: E2E giữ nguyên và phải xanh. Unit test hỏng vì service không còn dùng `PrismaService` thì **sửa tối thiểu**: thay mock Prisma bằng repository giả (object cài đặt abstract class port). Không viết test mới (test phase làm sau), không xoá/skip test.

## Việc cần làm

1. Cấu trúc: `voucher/domain/` (`voucher-status.ts` giữ, thêm `voucher.model.ts`), `voucher/application/ports/voucher.repository.ts` (bảng `vouchers`, `voucher_usages`), `voucher/infrastructure/prisma-voucher.repository.ts`, `voucher/admin/controllers/`, `voucher/admin/dto/`.
2. Service Back-office: `voucher/application/admin-voucher.service.ts`, không export. File hiện 219 dòng: tách theo trách nhiệm để ≤ 200 (ví dụ tách phần kiểm tra/chuẩn hoá đầu vào thành hàm thuần ở `domain/`).
3. **Class công khai** `voucher/application/voucher.service.ts` (`VoucherService`), provider duy nhất `VoucherModule` export cho nghiệp vụ:
   - `evaluate(code, buyer: { userId?: string; phone: string }, subtotal, options?: { lockForUpdate?: boolean })` → snapshot voucher (các field `VoucherSnapshot` checkout đang dùng: id, code, type, value, maxDiscount, minSubtotal, totalLimit, perBuyerLimit, usedCount). Điều kiện y hệt `findVoucher` trong `checkout.service.ts` (đang hoạt động, đúng hạn, đủ `minSubtotal`, chưa vượt `totalLimit`, chưa vượt `perBuyerLimit` theo phone hoặc userId). Không đạt thì ném `InvalidInputError` với **đúng message hiện tại**; checkout tự đổi loại lỗi theo bước (task 46). `lockForUpdate` khoá dòng voucher theo `code` (như `lockVoucher`).
   - `recordUsage(voucherId, orderId, buyer, discount)` → tăng `usedCount` và tạo `voucher_usages` (y hệt checkout).
   - Chưa đổi checkout gọi các hàm này.
4. Đổi exception trong domain/application sang lỗi chung, giữ message.
5. Cập nhật tài liệu module voucher nếu có (`docs/architecture/02-modules.md` §4).

## Tiêu chí nghiệm thu chung

- [ ] `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` đều đạt.
- [ ] Swagger không đổi: `npm run openapi:write` rồi `git diff --exit-code docs/openapi/openapi.json` không có khác biệt.
- [ ] Trong `src/modules/voucher/`: chỉ file trong `infrastructure/` import `PrismaService`, `#src/generated/**` hay `@nestjs-cls/**`. Kiểm bằng `grep -rnE "PrismaService|#src/generated|@nestjs-cls" <thư mục module> | grep -v /infrastructure/` → rỗng.
- [ ] `domain/` và `application/` không import HTTP exception của `@nestjs/common`; chỉ ném lỗi từ `src/common/errors/`.
- [ ] Module được thêm vào danh sách module đã chuyển đổi của `scripts/generate-oxlint-boundaries.ts` (chạy lại script, `oxlint.json` cập nhật) và vào mục **Migrated modules** của `.claude/rules/module-architecture.md` (`voucher`); chạy `npm run agents:check` đạt.
- [ ] Tài liệu mô tả cây/đường dẫn được cập nhật trong cùng PR (`docs/architecture/02-modules.md` §4, `docs/architecture/modules/*.md` liên quan, `src/**/README.md`); `grep` các đường dẫn cũ trong `docs/` và `src/**/README.md` → rỗng.
- [ ] File vừa tách khỏi danh sách tạm `max-lines` (nếu có) được xoá khỏi danh sách đó.
- [ ] `report.md` ghi: số file trước/sau, các khác biệt so với spec, bug phát hiện nhưng không sửa.
