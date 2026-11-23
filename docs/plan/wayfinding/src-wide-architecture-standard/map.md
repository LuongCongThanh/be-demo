# Chuẩn kiến trúc thống nhất cho toàn `src/modules`

## Destination

Một bộ chuẩn kiến trúc và chất lượng code thống nhất cho toàn `src/modules` (một kiến trúc cho mọi module, tổng quát hóa từ Category v1.6, hết mâu thuẫn giữa các tài liệu), kèm danh sách task triển khai có thứ tự trong `docs/plan/tasks/`. Map này chỉ tạo đặc tả, không sửa code ứng dụng.

## Notes

- Mỗi ticket grilling: gọi Skill `grilling` và `domain-modeling`. Đọc `docs/agents/domain.md`, `docs/agents/issue-tracker.md`, `GLOSSARY.md` trước khi làm.
- Các quyết định của map [Refactoring boundaries in `src/modules`](../feature-module-boundaries/map.md) (ticket 01–06) là **tiền đề có hiệu lực**. Chỉ mở lại một quyết định khi code hoặc yêu cầu mới mâu thuẫn trực tiếp với nó, và mỗi mâu thuẫn là một ticket riêng.
- Tài liệu liên quan: [01 Category folder structure v1.6](../../../architecture/refactor/01-category-folder-structure-convention-v1.6.md), [02 Category clean code v1.6](../../../architecture/refactor/02-category-clean-code-quality-convention-v1.6.md), [02-modules.md](../../../architecture/02-modules.md), [`.claude/rules/prisma-schema.md`](../../../../.claude/rules/prisma-schema.md).
- Một kiến trúc cho mọi module, không ngoại lệ (ADR 0015); thư mục chỉ tạo khi có file.
- Mỗi file tối đa 200 dòng (mục tiêu 150), trừ code sinh tự động và file test.
- Rule cho agent: `.claude/rules/module-architecture.md` (Claude Code), `.github/instructions/module-architecture.instructions.md` (Copilot), `src/AGENTS.md` (Codex); mỗi PR refactor cập nhật mục "Migrated modules" của rule.
- Tiêu chí nghiệm thu cho các task triển khai: build, lint, typecheck, Swagger diff rỗng khi chỉ refactor, giữ nguyên hành vi (theo quyết định 05 của map cũ).
- Mọi task triển khai: PR nào di chuyển, thêm hoặc xóa file thì phải cập nhật trong cùng PR mọi tài liệu mô tả cây thư mục hoặc đường dẫn đó (ví dụ `docs/architecture/02-modules.md` §4, `docs/architecture/modules/*.md`, `src/**/README.md`, cây ví dụ trong tài liệu chuẩn). Người review grep đường dẫn cũ trong `docs/` và `src/**/README.md`, kết quả phải rỗng. Quy tắc này nối tiếp quyết định [How should the per-file responsibility inventory stay accurate?](../as-built-backend-architecture/issues/01-file-inventory-maintenance.md).
- Viết bằng tiếng Việt; thuật ngữ kỹ thuật giữ tiếng Anh.

## Decisions so far

<!-- Mỗi ticket đã resolved: một dòng gist + link. -->

- [Khả năng của oxlint để chặn import sai ranh giới](./issues/04-oxlint-boundary-capability.md): luật domain và controller làm được; luật giữa module phải viết override riêng cho từng module; override thay thế chứ không gộp nên mỗi override phải mang đủ bộ luật.
- [Kiến trúc tham chiếu cho dự án NestJS](./issues/10-nestjs-reference-architectures.md): bộ khung đề xuất khớp Hexagonal nhưng việc lặp `application/` trong từng thư mục bề mặt là dạng lai không tham chiếu nào dùng; có 3 phương án giữ "một kiến trúc" với chi phí khác nhau.
- [Bộ tài liệu chuẩn cho toàn src](./issues/01-canonical-standard-documents.md): một kiến trúc Hexagonal cho mọi module (ADR 0015), bộ khung A' (thư mục bề mặt chỉ chứa phần HTTP), chuẩn chung nằm ở `docs/convention/`, xóa doc 01/02 v1.6.
- [Bản đồ chuyển đổi cho từng module](./issues/02-layered-structure-criteria.md): mỗi feature một Persistence Port dạng abstract class, port dùng chung cho Mail/Storage/Audit, thêm `presentation/` cho phần HTTP dùng chung hai bề mặt, Domain Model là `type` thuần, chỉ Category tách Nest module theo bề mặt, feature cùng module chỉ dùng chung `domain/` và `presentation/`.
- [Chiến lược xử lý lỗi toàn src](./issues/03-error-handling-strategy.md): một bộ lỗi nghiệp vụ dùng chung ở `src/common/errors/`, `AllExceptionsFilter` đổi sang HTTP ở một chỗ, response không đổi; xóa interceptor riêng của Category; tầng HTTP vẫn dùng exception của NestJS.
- [Thư viện transaction có chạy với NestJS 12 và Prisma 7 không](./issues/11-nestjs-cls-transactional-compatibility.md): `nestjs-cls` transactional tương thích, đã thử commit/rollback/lồng nhau/row lock/isolation trên Postgres thật; cần kiểm lại DI trong vitest.
- [Hợp đồng transaction trong và giữa các module](./issues/05-transaction-contract.md): một cách duy nhất "hộp giao dịch" qua `nestjs-cls`, service chỉ phụ thuộc `TransactionRunner` của dự án, port không có `tx`, giao dịch lồng nhập vào giao dịch đang có, không gọi ra ngoài trong giao dịch.
- [Ownership dữ liệu cho cart và checkout](./issues/06-cart-checkout-ownership.md): Catalog/Inventory/Voucher mở hàm công khai tối thiểu qua một class công khai riêng mỗi module, chiều gọi một chiều (catalog chỉ gọi inventory), checkout tạm sở hữu quote/order.
- [Cách tách checkout](./issues/07-checkout-structure.md): chia thành calculator, quote, place-order cùng hàm thuần trong `domain/`; idempotency thành port dùng chung ở hạ tầng; module chủ tự khóa dòng khi checkout yêu cầu, giữ thứ tự khóa.
- [Bộ luật lint bắt buộc và lộ trình bật](./issues/08-lint-boundary-rules.md): 7 luật chặn bằng oxlint (tầng, lỗi HTTP, ranh giới module/feature, 200 dòng, cấm import tương đối); override sinh bằng script; bật error theo từng module khi refactor xong.
- [Chia việc triển khai thành task](./issues/09-implementation-task-breakdown.md): 12 task 38–49 (tài liệu → nền móng → lint → từng module → hoàn tất), mỗi task một PR giữ nguyên hành vi; refactor trước task tính năng 29 và 33.

## Not yet specified

Không còn. Map đã tới đích ngày 2026-11-24: mọi ticket đã resolved; việc triển khai theo task 38–49 trong `docs/plan/tasks/`.

## Out of scope

- Phase viết test (đã hoãn đến sau rebuild); map chỉ ghi tiêu chí nghiệm thu build/lint/typecheck/Swagger diff.
- Thiết kế các module chưa tồn tại trong `src/modules` (ordering, payments, fulfillment...).
- Tầng dùng chung `common/`, `http/`, `security/`, `infrastructure/`, trừ phần filter/interceptor lỗi mà ticket 03 cần và các port dùng chung cho Mail/Storage/Audit cạnh `infrastructure/` (theo ticket 02).
