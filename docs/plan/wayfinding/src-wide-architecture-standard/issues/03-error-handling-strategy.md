# Chiến lược xử lý lỗi toàn src

Type: grilling
Status: resolved

## Question

Toàn `src/modules` dùng một cách xử lý lỗi nào? Hiện có hai kiểu song song, ngay cả trong Category: `domain/errors` + `category-error-mapping.interceptor`, nhưng các service `storefront/application/category/category.service.ts`, `admin/application/image/admin-category-image.service.ts`, `application/shared/localization/category-language.service.ts` vẫn ném `NotFoundException`/`BadRequestException`. Mọi module khác ném HTTP exception từ service. Lựa chọn: (a) service ném HTTP exception; (b) lỗi nghiệp vụ + filter/interceptor ánh xạ sang HTTP; (c) kết hợp theo mức cấu trúc (ticket 02). Quyết định cả nơi đặt bộ ánh xạ (filter toàn cục trong `http/filters` hay interceptor theo module) và cách giữ nguyên response contract hiện tại.

## Answer

Chốt qua grilling ngày 2026-11-24.

1. **Bộ lỗi nghiệp vụ dùng chung** ở `src/common/errors/`: `NotFoundError` (404), `ConflictError` (409), `InvalidInputError` (400), `UnprocessableError` (422), `UnauthenticatedError` (401), `ForbiddenError` (403), cùng kế thừa một lớp gốc. `AllExceptionsFilter` (`src/http/filters/all-exceptions.filter.ts`) đổi chúng sang HTTP ở **một chỗ duy nhất**. Response giữ nguyên: cùng mã HTTP, cùng `message`, cùng shape `{ statusCode, message, requestId }`.
2. **`domain/` và `application/` chỉ ném lỗi từ bộ chung** (hoặc lớp con của nó); không import HTTP exception của `@nestjs/common`. Thay 164 chỗ `throw new XxxException` trong 24 file chủ yếu bằng đổi tên class, giữ nguyên message.
3. **Category:** xóa `CategoryErrorMappingInterceptor`; các lỗi trong `domain/errors/category-errors.ts` kế thừa bộ lỗi chung (ví dụ `CategorySlugConflictError extends ConflictError`).
4. **Lỗi Prisma:** filter giữ việc đổi `P2002`/`P2003`/`P2011`/`P2014`/`P2025` sang HTTP làm lưới an toàn. Adapter chỉ tự bắt lỗi Prisma khi cần message nghiệp vụ cụ thể (ví dụ trùng slug) và đổi sang lỗi chung.
5. **Tầng HTTP** (`presentation/`, `admin/`, `storefront/`: guard, strategy, controller) vẫn được ném HTTP exception của NestJS.
6. **Tài liệu cần sửa khi triển khai:** `docs/convention/error-logging-conventions.md` §5, `docs/convention/api-rules.md` R2 và R6 (bỏ "service ném `NotFoundException`" và câu ngoại lệ Category), `.claude/rules/error-logging.md`.
