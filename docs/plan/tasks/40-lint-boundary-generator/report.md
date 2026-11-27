# Report: Script sinh luật lint ranh giới

## Đã làm

- `scripts/generate-oxlint-boundaries.ts` (chạy bằng `tsx`) sinh `oxlint.json`; `npm run lint:boundaries` ghi, `npm run lint:boundaries:check` so sánh và exit 1 nếu khác. Đầu ra được format bằng prettier theo cấu hình repo để `format:check` không xung đột.
- Đầu vào trong script: `MIGRATED_MODULES` (rỗng), `MODULE_FEATURES` (`catalog`, `identity`), `MAX_LINES_TEMPORARY_EXEMPT`. Danh sách module lấy từ `src/modules/*`.
- CI: bước `npm run lint:boundaries:check` trong job `lint`.
- Probe: `scripts/oxlint-boundaries/boundaries.spec.ts` (39 test, chạy bằng `vitest`). Fixture được ghi vào thư mục tạm khi chạy, không nằm trong `src/`; mỗi luật 1-7 có một ca vi phạm bị bắt và một import hợp lệ không bị bắt, kèm các ca file khớp nhiều nhóm.
- Cập nhật mục Lint của `.claude/rules/module-architecture.md` và ghi chú "Trạng thái triển khai" + khung §9 của `docs/convention/module-architecture-conventions.md`.

## Phát hiện về oxlint (quan trọng cho các task chuyển module)

1. `importNames` hoạt động trong `paths` (`{ name: '@nestjs/common', importNames: [...] }`), nên luật 3 không cần grep CI.
2. Mọi `patterns` của cùng một rule dùng chung MỘT bộ khớp gitignore: dấu `!` ở pattern này re-include kết quả của pattern khác. Probe cho thấy `!#src/modules/<self>/**` (cách ticket 04 đề xuất cho luật 5) làm luật 2 và 6 im lặng không bắt gì. Do đó luật 5 được sinh thành một pattern cho từng module khác, chỉ phủ định đúng hai file công khai của module đó (`<b>.module.js`, `application/<b>.service.js`), không phủ định chính module. Đây là chỗ lệch nhỏ so với ticket (kết quả hành vi giống hệt; ticket nói "liệt kê tường minh theo tên module").
3. oxlint in mỗi lỗi `no-restricted-imports` hai lần (đã biết từ ticket 04); probe loại trùng.
4. Override `excludeFiles` được hỗ trợ, nên luật tương đối + max-lines áp cho `src/**` trừ `src/generated/**` mà không cần override khôi phục.
5. Override `off` của `src/security/authorization/**` được thay bằng override chỉ giữ cấm import tương đối (bỏ permissions, vì thư mục này định nghĩa guard), để luật 7 không bị tắt.

## Danh sách tạm `max-lines`

Đếm lại bằng luật thật (`skipBlankLines`, `skipComments`), chỉ **7** trong 13 file ở ticket 09 vượt 200: `checkout.service.ts` (496), `access.service.ts` (299), `session.service.ts` (236), `prisma-category.repository.ts` (233), `prisma-category-translation.persistence.ts` (235), `admin-product.service.ts` (204), `cart.service.ts` (216). 6 file còn lại (`admin-voucher.service.ts`, `admin-product.controller.ts`, `auth.controller.ts`, `admin-category.service.ts`, `internal-account.service.ts`, `registration.service.ts`) đã dưới 200 khi bỏ dòng trống/comment nên không đưa vào danh sách. Không có file ngoài danh sách ticket vượt ngưỡng (task 39 không thêm file vượt).

## Thử nghiệm cục bộ (không commit)

Đặt `MIGRATED_MODULES = ['voucher', 'catalog']`, sinh lại và chạy oxlint trên `src/`: 18 dòng vi phạm thật (luật 1: 7, 2: 3, 3: 2, 4: 4, 6: 2; luật 5 không có vì không file nào import nội bộ module khác), ví dụ:

- Luật 1: `catalog/pricing/domain/active-sale-prices.ts:1` import `PrismaService`; `catalog/product/domain/product-search.query.ts:1` và `voucher/domain/voucher-status.ts:1` import `#src/generated/...`.
- Luật 3: `catalog/pricing/domain/sale-price-guards.ts:1` (`ConflictException`), `catalog/category/application/shared/localization/category-language.service.ts:1` (`BadRequestException`).
- Luật 2: `category-language-race.spec.ts:2-3` (PrismaService và adapter trong `application/`).
- Luật 4: `catalog/category/admin/dto/category/category-translation-response.dto.ts:2` và 3 file spec trong `admin/application/` import `#src/generated/...`.
- Luật 6: `catalog/product/dto/shared/variant-response.dto.ts:3` (import `product-option/dto/...`), `catalog/category/admin/controllers/admin-category-image.controller.ts:17` (import `product/dto/...`).

Sau thử nghiệm đã khôi phục script và `oxlint.json` (`lint:boundaries:check` đạt).

## Lưu ý / câu hỏi mở

- Cây thư mục hiện tại của Category có `admin/application/`. Glob `.../admin/**` đặt sau `.../application/**` nên thư mục đó nhận luật 4 chứ không phải luật 2/3. Task 43 sẽ đưa về bố cục chuẩn nên không xử lý ở đây.
- Spec test (`*.spec.ts`) vẫn chịu luật import 1-6 (chỉ miễn `max-lines`), nên các spec hiện có trong `application/` sẽ bị bắt khi module chuyển đổi (xem luật 2/4 ở trên); task chuyển module phải sửa tối thiểu hoặc đặt đúng chỗ.
- `max-lines` chỉ áp cho `src/**`, không áp cho `test/`.
