# Bộ tài liệu chuẩn cho toàn src

Type: grilling
Status: resolved

## Question

Tài liệu nào là nguồn chuẩn cho kiến trúc và chất lượng code của toàn `src/modules`? Hiện có ba nguồn nói khác nhau: `.claude/rules/prisma-schema.md` ("không cần Repository layer"), `docs/architecture/02-modules.md` ("Catalog khác giữ Controller → Service → Prisma; wiring tại `CategoryModule`"), và doc 01 v1.6 ("bắt buộc có Port khi outbound I/O; wiring tại `CategoryCoreModule`"). Quyết định: tên và vị trí của tài liệu chuẩn chung; doc 02 (clean code) có được tổng quát hóa thành chuẩn toàn `src` không; doc 01 thu gọn thành "Category: ví dụ cấu trúc nhiều tầng" ra sao (cập nhật cây cho khớp code, bỏ bảng migration §8, xử lý phần lặp giữa 01 và 02); các rule agent (`.claude/rules/`) dẫn chiếu thế nào; thuật ngữ nào (ví dụ Surface: Admin/Storefront) cần vào `GLOSSARY.md`; có cần ADR cho quyết định này không. Quyết định thêm: tài liệu chuẩn có chứa cây thư mục cụ thể không, hay chỉ nêu quy tắc rồi trỏ sang code thật (ví dụ "xem `src/modules/catalog/category/`"). Bằng chứng cần cân nhắc: cây trong doc 01 v1.6 đã lệch so với code (thiếu `ports/storage/`, `application/shared/translation/`, `presentation/` ở root).

## Answer

Chốt qua grilling ngày 2026-11-24, có đối chiếu với [Kiến trúc tham chiếu cho dự án NestJS](./10-nestjs-reference-architectures.md).

**Kiến trúc** ([ADR 0015](../../../../adr/0015-one-layered-architecture-for-every-module.md)):

- Một kiến trúc Hexagonal cho **mọi** module, không ngoại lệ: Domain thuần; service ở `application/` gọi Port; mọi truy cập DB đi qua Persistence Port, adapter Prisma ở `infrastructure/`; wiring DI ở file module. Thay thế quyết định 01 của map `feature-module-boundaries` và `api-rules.md` R3.
- Bộ khung thư mục chung (phương án A'), chỉ tạo thư mục khi có file:
  - `domain/`: model, luật thuần, lỗi nghiệp vụ.
  - `application/`: service/use case và `ports/`. Không lặp `application/` trong thư mục bề mặt.
  - `infrastructure/`: adapter Prisma, client bên ngoài, storage.
  - `admin/` (bề mặt Back-office) và `storefront/`: **chỉ** controllers, dto, mappers (và guard riêng của bề mặt nếu có). Giữ thư mục bề mặt kể cả khi module chỉ có một bề mặt.
  - `<module>.module.ts`. Module nhiều feature (`catalog`) lặp cùng bộ khung trong mỗi feature.
- Tách Core/Admin/Storefront Nest module là quy tắc có điều kiện (module có cả hai bề mặt và mỗi bên có provider riêng đáng kể); việc tách chỉ thêm file `*.module.ts`, không đổi bố cục thư mục.
- Cấu trúc phải dễ hiểu: mỗi thành phần chỉ có một chỗ để tìm.

**Tài liệu:**

- `docs/convention/` là nơi duy nhất chứa chuẩn chung. Thêm một file kiến trúc module mới tổng quát hóa từ doc 01 v1.6 (tầng, Port/adapter, DI, 4 dạng dữ liệu, mapper, transaction boundary, bộ khung A'). Phần riêng của doc 02 v1.6 đưa vào các file convention tương ứng (hoặc một file chất lượng code mới); bỏ phần lặp với `api-rules.md`, `error-logging-conventions.md`, `coding-style-conventions.md`.
- Xóa `docs/architecture/refactor/01-…v1.6.md` và `02-…v1.6.md` sau khi tổng quát hóa; Category chỉ còn là ví dụ ngắn trỏ sang code thật.
- Tài liệu chuẩn không vẽ cây thư mục cụ thể, chỉ bảng tên thư mục và vai trò. Cây as-built ở `docs/architecture/02-modules.md` §4 và `docs/architecture/modules/*.md`, giữ đúng nhờ quy tắc cập nhật trong cùng PR (Notes của map).
- Bỏ mọi câu "Category là ngoại lệ" (convention README, coding-style §2.1–§2.3, api-rules R2/R3/R6/R7, prisma-conventions §4); thay bố cục `controllers/admin`, `services/storefront` ở coding-style §2.2 bằng bộ khung A'.
- Không đổi tên thư mục `admin/` (tốn công, không đổi hành vi); convention ghi rõ `admin/` và tiền tố `admin-` nghĩa là bề mặt Back-office, không phải Vai trò Admin. Đã thêm **Storefront** và **Back-office** vào `GLOSSARY.md`.
- Không tạo rule agent mới; sửa `.claude/rules/prisma-schema.md` (bỏ "a Repository layer is unnecessary") và `api-conventions.md` để dẫn chiếu chuẩn mới, chạy `npm run agents:check`.
- Mâu thuẫn `api-rules.md` R7 ("trả thẳng Prisma type được") với kiến trúc mới: theo kiến trúc mới, Prisma type không đi qua Port nên không thể trả thẳng; R7 sửa theo.

### Bổ sung ngày 2026-11-24 (chốt trong buổi làm [Cách tách checkout](./07-checkout-structure.md))

- **Giới hạn độ dài file:** mục tiêu khoảng 150 dòng, **giới hạn cứng 200 dòng** mỗi file, không đếm dòng trống và comment; lint chặn bằng `max-lines`. Vượt 200 thì tách file theo trách nhiệm. Thay thế câu "không áp dụng ngưỡng dòng cứng" ở `docs/architecture/02-modules.md` và doc 02 v1.6 §14.
- **Miễn:** code sinh tự động (`src/generated/`) và file test (`*.spec.ts`, `*.e2e-spec.ts`). Ngoại lệ cho một file cụ thể chỉ khi có comment giải thích lý do ngay trong file.
- Thời điểm ghi nhận: 13 file code vượt 200 dòng (danh sách trong [Chia việc triển khai thành task](./09-implementation-task-breakdown.md)).

### Bổ sung ngày 2026-11-24 (thay Q7, chốt trong buổi làm [Bộ luật lint bắt buộc và lộ trình bật](./08-lint-boundary-rules.md))

Người dùng yêu cầu lưu kiến trúc cho cả 3 agent (Claude Code, Codex, Copilot), nên **có tạo rule agent mới**, thay cho Q7 "không tạo rule mới":

- `.claude/rules/module-architecture.md` (Claude Code, `paths: src/modules/**/*.ts`, `src/infrastructure/**/*.port.ts`), `.github/instructions/module-architecture.instructions.md` (Copilot, `applyTo: src/modules/**`), một dòng trong `src/AGENTS.md` (Codex). `npm run agents:check` đạt.
- Rule có mục **Migration status**: áp dụng đầy đủ cho module mới, feature mới và module đã chuyển đổi; module chưa chuyển đổi giữ cấu trúc hiện tại khi sửa nhỏ, không chuyển đổi nửa chừng. Danh sách "Migrated modules" do mỗi PR refactor cập nhật.
- Các câu mâu thuẫn trong `coding-style.md` (module nhỏ để phẳng, ngưỡng 300 dòng), `error-logging.md` (service ném `NotFoundException`), `api-conventions.md` và `prisma-schema.md` (không cần Repository) được thêm câu dẫn chiếu sang rule mới cho phạm vi module mới/đã chuyển đổi; ngưỡng dòng đổi sang 150/200.
- Khi tài liệu chuẩn trong `docs/convention/` được viết xong, rule này đổi dẫn chiếu sang đó.
