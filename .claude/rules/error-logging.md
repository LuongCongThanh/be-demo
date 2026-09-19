---
paths:
  - 'src/**/*.ts'
---

# Error handling & logging (condensed — full rationale: docs/convention/error-logging-conventions.md)

- `AllExceptionsFilter` (global, `src/common/filters/all-exceptions.filter.ts`) là **safety net cho lỗi không lường trước**, không phải nơi định nghĩa domain error. Domain error đã biết trước (trùng unique, còn record con tham chiếu, sai business rule...) → **ném rõ ràng ở service** bằng `NotFoundException`/`ConflictException`/... kèm message cụ thể, không để rơi xuống filter.
- Response lỗi shape cố định: `{ statusCode, message, requestId }`. Prisma map sẵn: `P2002`→409, `P2003`→409, `P2025`→404, còn lại→500.
- Log level: **`5xx` filter tự `.error()` kèm stack — không log lại ở service**. **`4xx` không log** (luồng nghiệp vụ bình thường, log sẽ tạo noise). Business event quan trọng log `.log()` qua `new Logger(ClassName.name)`.
- **Không bao giờ log secret**: password, token thô (JWT/refresh/reset-code), header `Authorization`.
- `requestId` tự động gắn vào mọi `Logger` call qua `AppLogger` toàn cục — **không cần tự thêm** vào message khi viết service mới.
- **Không** `try/catch` chỉ để log rồi throw lại nguyên văn (filter đã tự log 5xx, sẽ tạo log trùng). **Có** `try/catch` khi: (a) dịch lỗi tầng dưới (vd. Prisma `P2002`) thành domain exception cụ thể, hoặc (b) side-effect best-effort được phép fail (vd. gửi email) — trường hợp này **bắt buộc tự log rõ ràng** trước khi nuốt lỗi, không nuốt im lặng.
- Pre-check (unique/FK) trước khi ghi chỉ là **UX layer** trả message đẹp — **không thay thế** unique constraint/FK constraint ở DB, vẫn có race condition giữa check và write.
