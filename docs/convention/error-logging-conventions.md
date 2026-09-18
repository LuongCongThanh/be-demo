# Convention: Error Handling & Logging (ecommerce project)

> 📖 Xem [README.md](README.md) để biết vị trí file này trong toàn bộ convention và thứ tự đọc.

Tài liệu này dành cho **dev trong team tự đọc và tự viết code**. Đọc xong, bạn biết: lỗi ở mọi tầng (domain, Prisma, không lường trước) đi đâu về đâu, response lỗi client nhận có shape gì, và log ra sao để trace được 1 request cụ thể qua nhiều dòng log.

## 1. Kiến trúc tổng quan

```
Domain error đã biết trước    →  throw NotFoundException/ConflictException/... ở service
Prisma error (P2002/P2003/P2025) → AllExceptionsFilter tự map sang HTTP status đúng
Lỗi không lường trước           →  AllExceptionsFilter bắt, trả 500 generic, log stack
```

`AllExceptionsFilter` (`../../src/common/filters/all-exceptions.filter.ts`, đăng ký global qua `APP_FILTER` trong `app.module.ts`) là **safety net cho lỗi không lường trước, không phải nơi định nghĩa domain error** — nguyên tắc này giữ nguyên như đã ghi ở `api-conventions.md` §B5/§B7, tài liệu này chỉ mô tả phần filter đã được implement thật (trước đây là gap chưa code).

## 2. Response shape lỗi — thống nhất toàn app

```json
{ "statusCode": 404, "message": "Resource #123 not found", "requestId": "6bc8950d-..." }
```

- `message` có thể là `string` (lỗi đơn) hoặc `string[]` (nhiều lỗi validate cùng lúc từ `class-validator`) — giữ nguyên hành vi mặc định của `ValidationPipe`, không ép về 1 string.
- `requestId` luôn có mặt (trừ khi middleware chưa chạy tới, cực hiếm) — dùng để đối chiếu với dòng log server khi debug/support (xem [§4](#4-request-id--trace-1-request-qua-nhiều-dòng-log)).
- Prisma error được map: `P2002` → `409` (unique constraint), `P2003` → `409` (foreign key constraint), `P2025` → `404` (record không tồn tại), còn lại → `500`.

## 3. Log level — khi nào log gì

- **`5xx` (không lường trước)**: `AllExceptionsFilter` tự động `.error()` kèm stack trace. Không cần tự log lại ở service.
- **`4xx` (lỗi nghiệp vụ dự kiến — 400/401/403/404/409...)**: **không log** ở tầng filter — đây là luồng bình thường (user nhập sai, chưa đăng nhập, trùng dữ liệu...), log ra sẽ tạo noise, khó tìm lỗi thật giữa hàng nghìn dòng "login failed vì sai password".
- **Business event quan trọng** (đăng ký thành công, huỷ đơn, thanh toán...) — tự log ở service bằng `Logger` (`new Logger(ClassName.name)`, pattern đã có ở `AuthService`/`MailService`) ở mức `.log()`; audit trail chi tiết hơn (ai làm gì, lúc nào) nằm ngoài phạm vi convention này — xem `api-conventions.md` §16 khi cần.
- **Không log secret**: password, token thô (JWT, refresh token, reset-password code), `Authorization` header — không bao giờ đưa vào message log, kể cả lúc debug tạm thời.

## 4. Request-id — trace 1 request qua nhiều dòng log

Mỗi request HTTP được gắn 1 `requestId` (UUID) ngay từ `RequestIdMiddleware` (`../../src/common/request-id.middleware.ts`, áp dụng cho `'*'` trong `AppModule.configure()`):

- Nếu request đã có header `X-Request-Id` (từ load balancer/gateway phía trước) → giữ nguyên, không tự sinh mới — để trace xuyên suốt nhiều service trong hệ thống lớn hơn.
- Ngược lại tự sinh bằng `randomUUID()`.
- Luôn trả lại trong response header `X-Request-Id` — client/QA có thể lấy giá trị này để báo lỗi kèm log.
- Lưu vào `AsyncLocalStorage` qua `RequestContext` (`../../src/common/request-context.ts`) — không cần truyền tay qua tham số hàm.

**Không cần sửa gì ở code cũ để có request-id trong log.** `AppLogger` (`../../src/common/app-logger.ts`, đăng ký qua `app.useLogger(new AppLogger())` trong `configureApp()`) tự động gắn `[requestId]` vào đầu message của **mọi** `Logger` instance sẵn có trong codebase — vì NestJS route mọi `new Logger(context)` qua logger đã đăng ký toàn cục. Ví dụ log thật:

```
[Nest] 46792 - ... [MailService] [922cba7c-8aa7-4c51-9c5b-7316afbb6ace] [DEV] Would send verification email to ...
```

> Viết code service mới **không cần** tự thêm request-id vào message — cứ `this.logger.log('...')` như bình thường, `AppLogger` tự lo phần còn lại.

## 5. Khi nào tự ném exception ở service (không dựa vào filter)

Không đổi so với `api-conventions.md` §B5: nếu domain error đã biết trước (trùng field unique, còn record con tham chiếu, sai business rule...), ném rõ ràng bằng `NotFoundException`/`ConflictException`/... **ở service**, kèm message cụ thể — không để rơi xuống `AllExceptionsFilter` (message Prisma generic, không nói rõ nghiệp vụ gì). Pre-check (unique, FK) vẫn không thay thế constraint ở DB — filter là lớp bảo vệ cuối cùng, không phải lớp duy nhất.

## 6. Khi nào tự `try/catch` trong service

**Không** bọc `try/catch` chỉ để log rồi ném lại nguyên văn (`catch (e) { this.logger.error(e); throw e; }`) — `AllExceptionsFilter` đã tự log mọi lỗi `5xx` kèm stack, log thêm ở service chỉ tạo 2 dòng log trùng nhau cho cùng 1 lỗi.

**Có** dùng `try/catch` khi:

- **Dịch lỗi tầng dưới thành domain exception cụ thể** (vd. bắt `Prisma.PrismaClientKnownRequestError` mã `P2002` để ném `ConflictException` với message rõ nghĩa nghiệp vụ — xem [§5](#5-khi-nào-tự-ném-exception-ở-service-không-dựa-vào-filter)).
- **Side-effect không quan trọng bằng luồng chính, cho phép fail mà không làm hỏng cả request** (best-effort — vd. gửi email xác thực thất bại không nên làm `register()` trả lỗi cho user). Trường hợp này **phải tự log lỗi rõ ràng** trước khi nuốt nó — nuốt lỗi mà không log nghĩa là không ai biết side-effect đó từng thất bại (filter không thấy lỗi vì bạn đã bắt nó).

## Checklist khi thêm endpoint mới

- [ ] Domain error đã biết trước ném rõ ràng ở service, không phó mặc cho `AllExceptionsFilter`
- [ ] Không log secret (password, token, header `Authorization`) trong bất kỳ message log nào
- [ ] Business event quan trọng (nếu có) log ở mức `.log()`, không cần tự thêm request-id
- [ ] Không tự bắt exception rồi nuốt lỗi im lặng — nếu nuốt (best-effort side-effect), phải tự log rõ ràng (xem [§6](#6-khi-nào-tự-trycatch-trong-service))
