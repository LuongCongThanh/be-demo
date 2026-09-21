---
paths:
  - 'src/**/*.controller.ts'
  - 'src/**/*.service.ts'
  - 'src/**/*.dto.ts'
  - 'src/**/*.module.ts'
  - 'src/main.ts'
---

# API conventions — agent-condensed (đầy đủ walkthrough từng bước + code mẫu: docs/convention/api-conventions.md)

Đây là bản rút gọn cho agent viết code — chỉ liệt kê điểm hành động/dễ sai. Đọc doc gốc khi cần code mẫu đầy đủ hoặc business rule của 1 resource cụ thể (sống ở doc riêng resource đó, vd. `docs/categories-module-plan.md`).

## Flow tổng quát (20 bước, xem §A trong doc gốc để chi tiết)

Requirement → Business Rules → API Contract → Authorization → Idempotency/Concurrency → DB Impact → Migration → Scaffold → DTO+Validation → Service → Data Access → Transaction (nếu cần) → Controller → Exception Mapping → Response DTO → Logging/Audit → Swagger → Testing → Lint/Build → PR.
CRUD đơn giản co gọn nhiều bước, nhưng vẫn tư duy từ Requirement xuống DB, không đi ngược.

## Điểm dễ sai / bắt buộc

- ESM: mọi import nội bộ có đuôi `.js`, kể cả import từ file `.ts`.
- **Không tạo `entities/`** (CLI `nest g resource` mặc định sinh) — trả thẳng Prisma type nếu resource không có field nhạy cảm.
- `PartialType` import từ **`@nestjs/swagger`**, không phải `@nestjs/mapped-types` (bản kia làm lệch metadata OpenAPI).
- Field server tự sinh (slug, mã đơn tự tăng...) **không** xuất hiện trong `CreateDto` — `ValidationPipe` global (`forbidNonWhitelisted`) sẽ 400 nếu client gửi lên, không âm thầm bỏ qua.
- **Không pre-fetch chỉ để xác nhận tồn tại** trước `update`/`remove` nếu filter đã map `P2025`→404 — để Prisma tự báo not-found. Chỉ pre-fetch khi cần chính record đó để check business rule (ownership, status...).
- Pre-check unique/FK trước khi ghi chỉ là UX layer — **không thay thế** DB constraint + exception filter (vẫn có race condition).
- **Không tạo Repository layer** cho CRUD đơn giản (`prisma.resource.x()` trực tiếp trong Service là đủ). Chỉ tách khi: query phức tạp tái dùng nhiều nơi, nhiều aggregate cùng 1 nghiệp vụ, transaction lớn, hoặc cần cô lập ORM.
- Transaction (`prisma.$transaction`) chỉ khi **cả 1 business operation** phải cùng thành công/thất bại như 1 đơn vị — không phải "cứ ≥2 write là cần transaction".
- Auth: **tái sử dụng** `JwtAuthGuard`/`RolesGuard`/`OwnershipGuard`/`@Roles()`/`@CurrentUser()` đã có sẵn, không tự viết cơ chế phân quyền riêng. Resource có khái niệm "chủ sở hữu" dùng thêm `OwnershipGuard`+`@OwnedResource()`.
- Response DTO: model có field nhạy cảm hoặc hay đổi (`User`, `Order`...) → **allow-list (Response DTO riêng)**, an toàn hơn blacklist `@Exclude()` (field mới mặc định bị lộ nếu quên đánh dấu).
- Swagger: `@ApiTags()` đặt tên đầy đủ ý nghĩa (không viết tắt trần như `'auth'`), khai `type:` cho response để OpenAPI đúng contract. **Mỗi route bắt buộc `@ApiOperation({ summary: '...' })`** mô tả đúng hành vi (không lặp tên method) — tham khảo `src/auth/auth.controller.ts`. **Mỗi field DTO client gửi lên bắt buộc `example:`** trong `@ApiProperty`/`@ApiPropertyOptional` (không bắt buộc cho Response DTO/`PaginationDto`) — tham khảo `src/auth/dto/*.dto.ts`. **Mỗi module bắt buộc `DocumentBuilder.addTag(name, description)` trong `src/main.ts`**, `name` phải khớp chính xác chuỗi đã khai ở `@ApiTags()` (kể cả module CRUD đơn giản chỉ dùng path số nhiều trần) — thiếu thì Swagger UI hiển thị nhóm route không có mô tả, không báo lỗi build. **Không sửa Postman thủ công** — Swagger (`/api-json`) là nguồn chuẩn, sync bằng `npm run postman:sync`.
- Pagination: `findAll()` luôn trả envelope `{ data, meta: { page, limit, total, totalPages } }`, `orderBy` **luôn có tie-breaker** (vd. `[{ createdAt: 'desc' }, { id: 'desc' }]`) — thiếu tie-breaker thì thứ tự phân trang không ổn định.
- `id` kiểu `String @default(uuid())` → `ParseUUIDPipe`; `Int @default(autoincrement())` → `ParseIntPipe` — luôn kiểm tra schema thật, không copy mặc định.

## Testing — ưu tiên đảo ngược so với trực giác

- Service unit test: **bắt buộc nếu service có business logic** (mock `PrismaService`).
- API e2e test: **bắt buộc cho endpoint public/quan trọng** (auth, checkout, payment...), khuyến nghị cho mọi CRUD.
- Controller unit test: **optional** — controller mỏng test kiểu `expect(serviceMock.x).toHaveBeenCalled()` không phát hiện được lỗi route/pipe/validation/filter; e2e cover việc đó tốt hơn.
- e2e dùng chung `configureApp()` (`src/bootstrap/configure-app.ts`) với `main.ts` — không duplicate cấu hình `ValidationPipe` giữa 2 nơi.

## Idempotency/Concurrency (API nghiệp vụ — checkout, payment, refund...)

- Idempotency: retry có tạo trùng record/side-effect không? Cân nhắc `Idempotency-Key` hoặc unique constraint.
- Concurrency: 2 request cùng đọc-rồi-ghi có làm sai invariant không (inventory, coupon, balance...)? `read→check→write` kể cả trong transaction chưa chắc đủ — cần atomic update (`UPDATE ... WHERE quantity >= x`) hoặc optimistic lock.
