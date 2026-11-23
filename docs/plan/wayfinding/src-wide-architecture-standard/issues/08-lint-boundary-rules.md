# Bộ luật lint bắt buộc và lộ trình bật

Type: grilling
Status: resolved

## Question

Dựa trên khả năng công cụ (ticket 04), kiến trúc chung (ADR 0015) và bản đồ chuyển đổi (ticket 02) và ranh giới module (ticket 06): những luật import nào được tự động hóa, cấu hình ở đâu, và bật theo lộ trình nào (warn → error, sửa vi phạm trước hay cùng lúc)? Luật nào chỉ kiểm bằng review vì công cụ không biểu đạt được? Bao gồm luật cấm `domain/` và `application/` import các HTTP exception của `@nestjs/common` (theo [Chiến lược xử lý lỗi toàn src](./03-error-handling-strategy.md)); kiểm tra `importNames` của `no-restricted-imports` có làm được không. Bao gồm luật `max-lines` (200, bỏ dòng trống và comment; miễn `src/generated/` và file test) theo bổ sung ở [Bộ tài liệu chuẩn cho toàn src](./01-canonical-standard-documents.md); xác định cách bật khi còn 13 file vượt ngưỡng.

## Answer

Chốt qua grilling ngày 2026-11-24, dựa trên [Khả năng của oxlint để chặn import sai ranh giới](./04-oxlint-boundary-capability.md).

**Luật chặn tự động (`no-restricted-imports`, `max-lines` của oxlint):**

1. `domain/` không import `@nestjs/**`, `#src/infrastructure/**`, `#src/generated/**`.
2. `application/` không import `#src/generated/**`, `PrismaService`, `nestjs-cls`/`@nestjs-cls/**`, hay adapter trong `infrastructure/`; chỉ được import port dùng chung `#src/infrastructure/**/*.port.js` (dùng phủ định trong `group`).
3. `domain/` và `application/` không import các HTTP exception của `@nestjs/common` (`importNames`), theo [Chiến lược xử lý lỗi toàn src](./03-error-handling-strategy.md).
4. `admin/`, `storefront/`, `presentation/` không import `PrismaService` hay `#src/generated/**`.
5. Module A chỉ import của module B đúng hai file: `#src/modules/<b>/<b>.module.js` và class công khai `#src/modules/<b>/application/<b>.service.js` (theo [Ownership dữ liệu cho cart và checkout](./06-cart-checkout-ownership.md)).
6. Trong cùng module, feature X chỉ import `domain/` và `presentation/` của feature Y.
7. `max-lines` 200 (bỏ dòng trống và comment), miễn `src/generated/**` và file test; cấm import tương đối `./`, `../` trong `src/` (trừ `src/generated/`), để không lách được luật 5 và 6.

**Cách cấu hình:** script `scripts/generate-oxlint-boundaries.ts` đọc `src/modules/*` (và feature của module nhiều feature) rồi sinh các override vào `oxlint.json`, gộp đủ bộ luật cho từng nhóm file (vì override thay thế chứ không gộp, và chỉ override khớp cuối cùng có hiệu lực), giữ luật permissions hiện có và xử lý override `off` của `src/security/authorization/**`. CI thêm bước kiểm tra `oxlint.json` khớp đầu ra của script. Không cài dependency-cruiser. Không dùng `regex` có lookahead (fail im lặng).

**Lộ trình bật:**

- Luật 1–6: mức `error` cho từng module ngay trong PR refactor module đó; script giữ danh sách "module đã chuyển đổi", mỗi PR thêm module của mình. Không dùng mức warning.
- Luật 7 `max-lines`: `error` ngay, kèm danh sách tạm 13 file đang vượt; mỗi PR tách file xóa file khỏi danh sách; danh sách rỗng thì bỏ.
- Cấm import tương đối: `error` ngay (hiện 0 vi phạm).
