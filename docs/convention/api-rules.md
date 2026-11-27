# Convention: quy tắc phát triển API (NestJS)

> 📖 Xem [README.md](README.md) để biết vị trí file này trong bộ convention. Đây là nguồn quy tắc API; [api-crud-walkthrough.md](api-crud-walkthrough.md) chỉ minh họa trình tự và code mẫu. Shape API (prefix, versioning, envelope lỗi, phân nhóm route) do [`../architecture/03-api.md`](../architecture/03-api.md) định nghĩa. Kiến trúc module (tầng, Port, lỗi, transaction, ranh giới) theo [module-architecture-conventions.md](module-architecture-conventions.md); chất lượng code theo [code-quality-conventions.md](code-quality-conventions.md).

Tài liệu cho **dev tự đọc và tự viết code**, không phải ngữ cảnh để agent tự sinh code. Đây là convention **generic** — business rule và trạng thái implement thật của từng resource sống ở `../architecture/modules/<module>.md`.

## A. Flow tổng quát — áp dụng cho MỌI API

```
01. Requirement               — giải quyết việc gì, cho ai?
02. Business Rules            — điều kiện hợp lệ, invariant, side-effect
03. API Contract              — method + route + request/response shape
04. Authorization Rules       — public hay cần auth? role/ownership nào?
05. Idempotency / Concurrency — retry có tạo trùng không? có race condition không?
06. Database Impact           — bảng nào đọc/ghi, có cần model mới không
07. Migration / Prisma Generate
08. Scaffold Module/Resource
09. Request DTO + Validation
10. Service / Use Case        — chứa business rule ở §02
11. Data Access / Prisma
12. Transaction (nếu cần)     — xem §R4
13. Controller                — route → validate param → delegate Service
14. Exception Mapping         — domain error → đúng HTTP status
15. Response DTO / Serialization
16. Logging / Audit / Metrics
17. Swagger / OpenAPI
18. Testing
19. Lint / Format / Build
20. PR                        — /ship
```

Với CRUD đơn giản nhiều bước co lại (§01–04 vài câu, §05/§12 thường bỏ qua) — nhưng **thứ tự tư duy luôn từ Requirement xuống Database**, không ngược lại. Bắt đầu từ "cần bảng nào" dễ biến API nghiệp vụ (`cancelOrder`) thành "update 1 field", bỏ sót rule.

**§05 Idempotency / Concurrency** (bắt buộc trả lời cho API nghiệp vụ):

- _Idempotency_: client gọi lại 2 lần (timeout/retry) có tạo 2 bản ghi/side-effect không? (`checkout`, `payment`, `refund`, webhook → cân nhắc `Idempotency-Key` hoặc unique constraint chống trùng.)
- _Concurrency_: 2 request đồng thời có cùng đọc rồi cùng ghi đè, sai invariant không? (`inventory`, coupon usage, balance, order status). `read → check → write` — kể cả trong transaction — chưa chắc đủ; dùng atomic update (`UPDATE ... WHERE quantity >= x`, `updateMany` + kiểm tra `count`) hoặc optimistic lock.
- Kỹ thuật sâu (outbox, saga, optimistic lock) → ghi ADR riêng (`../adr`) khi có nghiệp vụ thật cần.

**§16 Logging / Audit / Metrics**: tự hỏi có cần log business event (`order cancelled`, `login failed`), audit trail (ai làm gì, lúc nào — nhất là hành động có thể tranh chấp: huỷ đơn, hoàn tiền, đổi quyền), metric (tỷ lệ lỗi checkout...). CRUD nội bộ thường chỉ cần log mặc định; API nhạy cảm (`checkout`, `payment`, `refund`, `cancelOrder`, `login`) cần ít nhất audit log. Logging + request-id: [error-logging-conventions.md](error-logging-conventions.md); audit trail chi tiết chưa có — thiết kế chung khi cần, không để mỗi module tự log rời rạc.

## B. Quy tắc theo bước

Các mục dưới đây là quy tắc; code mẫu tương ứng ở [api-crud-walkthrough.md](api-crud-walkthrough.md).

### R1. Request DTO + Validation

- `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) bật qua `configureApp()` — dùng chung `main.ts` và e2e, không khai lại riêng.
- Mọi field có `class-validator` + `@ApiProperty`/`@ApiPropertyOptional`.
- `UpdateDto` dùng `PartialType` từ **`@nestjs/swagger`** (không phải `@nestjs/mapped-types` — mất metadata OpenAPI).
- **Bắt buộc `example:`** cho field client gửi lên. Không bắt buộc cho Response DTO, `PaginationDto` (đã có `default`), field `boolean`/enum hẹp tự rõ nghĩa.
- Field **server tự sinh** (slug, mã đơn...) không có trong Create DTO — client gửi lên bị 400 (không bị âm thầm bỏ qua).
- Param id dùng đúng pipe theo kiểu trong schema: `ParseUUIDPipe` (uuid) / `ParseIntPipe` (autoincrement).

### R2. Service / Use Case

> Các mục kiến trúc dưới đây (R2 lỗi chung, R3, R4, R7) áp dụng **với module mới hoặc đã chuyển đổi (xem Migration status)** của [rule agent](../../.claude/rules/module-architecture.md); `src/common/errors/` và `TransactionRunner` có từ task 39.

- Service không phụ thuộc `Request`/`Response` của Express — logic thuần, dễ test.
- Tên method: CRUD dùng `create/findAll/findOne/update/remove`; API nghiệp vụ dùng tên hành vi (`checkout()`, `cancelOrder()`).
- Đọc env qua `ConfigService`, không `process.env` — xem [config-environment-conventions.md](config-environment-conventions.md).
- **Lỗi nghiệp vụ đã biết trước ném rõ ở service** bằng bộ lỗi chung `src/common/errors/` (có từ task 39; `NotFoundError`, `ConflictError`, `InvalidInputError`, `UnprocessableError`, `UnauthenticatedError`, `ForbiddenError`... kèm message nghiệp vụ cụ thể), không phó mặc cho exception filter (message generic) và không ném HTTP exception của `@nestjs/common` ở `domain/`/`application/`. Filter đổi lỗi sang HTTP ở một chỗ duy nhất (R6). Chỉ tầng HTTP (controller, guard, strategy) được ném HTTP exception của NestJS. Xem [module-architecture-conventions.md §5](module-architecture-conventions.md#5-xử-lý-lỗi).
- **Không pre-fetch chỉ để xác nhận tồn tại** trước `update`/`delete` — filter đã map `P2025` → 404. Chỉ pre-fetch khi cần chính record đó để kiểm tra business rule (ownership, status, đếm record con...).
- **Pre-check không thay thế constraint ở DB.** Kiểm tra unique/đếm FK trước khi ghi chỉ là **UX layer** (message đẹp); vẫn có race giữa check và write. Unique/FK constraint ở DB + `AllExceptionsFilter` là lớp bảo vệ cuối — bắt buộc giữ.

### R3. Data access: Persistence Port

Với module mới hoặc đã chuyển đổi (xem Migration status), service **không** dùng `PrismaService` hay `#src/generated/**`. Mọi truy cập DB đi qua Persistence Port (mặc định một port mỗi feature, `abstract class` làm token) với adapter Prisma ở `infrastructure/`, kể cả CRUD đơn giản. Adapter chuyển kiểu Prisma sang Domain Model; Prisma type không đi qua Port. Chi tiết: [module-architecture-conventions.md §4](module-architecture-conventions.md#4-port-và-di). Module chưa chuyển đổi giữ cấu trúc hiện tại cho đến khi có task refactor riêng (mục _Migration status_ của [rule agent](../../.claude/rules/module-architecture.md)).

### R4. Transaction

- Không phải "cứ ≥2 write là cần transaction" — với module mới hoặc đã chuyển đổi (xem Migration status), mở giao dịch bằng `transactionRunner.run(async () => { ... })` khi **cả business operation phải thành công/thất bại như 1 đơn vị** (vd. `Order` + `OrderItem` + trừ tồn kho). Nhiều write độc lập có thể không cần; 1 write kèm `read → check` lại có thể cần transaction/lock (§05).
- Hợp đồng transaction (không `tx` qua port, không `@Transactional()` ở service, giao dịch lồng nhập vào giao dịch ngoài, khoá dòng bằng `{ lockForUpdate: true }`): [module-architecture-conventions.md §6](module-architecture-conventions.md#6-transaction).
- Điều kiện trạng thái đặt **trong `WHERE`** của conditional atomic update (`updateMany({ where: { id, status: 'PENDING' } })` + kiểm tra `count === 0` → 409), không tách "đọc status rồi update".
- **External call (payment gateway, email...) không đặt trong `run()`** — giữ lock/connection lâu, và không có gì tự đồng bộ nếu một bên thành công một bên rollback. Gọi ngoài transaction, ghi kết quả vào DB ở bước riêng; khi thật sự cần → outbox/saga qua ADR.

### R5. Authorization checkpoint

```
Cần authentication? → có → @Authorize()              (chỉ cần đăng nhập)
Cần authorization theo Quyền? → có → @Authorize(Permission.CATALOG_PRODUCT_VIEW)
Chỉ cho một loại tài khoản (vd. Khách hàng)? → @AuthorizeAccountType('CUSTOMER')
Cần kiểm chủ sở hữu? → có → thêm OwnershipGuard + @OwnedResource()
```

- Dùng `@Authorize(...permissions)` (`#src/security/authorization/permissions/authorize.decorator.js`, enum `Permission` ở `security/contracts/permission.enum.ts`) — một decorator gộp JWT + kiểm Quyền (phải có **mọi** Quyền khai báo) + Swagger bearer, đặt ở class (mặc định) hoặc method (ghi đè class, vd. Quyền `*_MANAGE`). Route chỉ dành cho một loại tài khoản (vd. `GET /me` của Khách hàng) dùng `@AuthorizeAccountType('CUSTOMER')` trong `security/authorization/account-type/`, không dùng Quyền. **Không** import `PermissionsGuard`/`RequirePermissions` trực tiếp (lint chặn). `@CurrentUser()` thuộc authentication; `OwnershipGuard` và `@OwnedResource()` thuộc `security/authorization/ownership/`. Resource có chủ sở hữu (`Cart`, `Order`) dùng thêm `OwnershipGuard`, không chỉ kiểm vai trò.
- Endpoint public: không gắn `@Authorize`. Kết luận "public" cũng phải là quyết định có chủ đích.
- Endpoint public-facing cần auth mà **chưa có auth** → gap **blocking**, không ship.

### R6. Exception mapping

`AllExceptionsFilter` (`src/http/filters/all-exceptions.filter.ts`, đăng ký global qua `APP_FILTER` trong `app.module.ts`) đã xử lý `HttpException`, các Prisma error được hỗ trợ và lỗi không lường trước. Không viết filter riêng cho resource. Filter là **safety net**, không thay thế domain error ở service (R2). Filter cũng đổi bộ lỗi chung `src/common/errors/` (có từ task 39) sang HTTP (cùng mã, `message` và shape response). Mapping và response shape hiện hành: [error-logging-conventions.md](error-logging-conventions.md).

### R7. Response DTO / Serialization

**Database Model ≠ API Response Contract.** Với module mới hoặc đã chuyển đổi (xem Migration status), luồng dữ liệu dưới đây là bắt buộc.

- Prisma type **không** đi qua Port và không trả thẳng ra API: adapter chuyển sang Domain Model, service trả Application Result, controller gọi mapper tạo Response DTO ([module-architecture-conventions.md §3](module-architecture-conventions.md#bốn-dạng-dữ-liệu)).
- Response DTO là **allow-list** (map thủ công, field mới không tự lộ ra), đặc biệt khi model có field nhạy cảm (`User.passwordHash`, các `tokenHash`) hoặc hay thêm field (`User`, `Order`).
- Không dùng blacklist (`ClassSerializerInterceptor` + `@Exclude()`): field mới mặc định bị lộ.
- Không dùng thư mục `entities/` do `nest g resource` sinh.

### R8. Swagger / OpenAPI

Swagger UI: `http://localhost:8080/docs`; spec: `/docs-json` (ADR 0002). Cấu hình ở `src/bootstrap/openapi.ts`; tắt bằng `SWAGGER_ENABLED=false` (mặc định tắt khi `NODE_ENV=production`).

- **`@ApiOperation({ summary })` cho mọi route** — câu mệnh lệnh mô tả đúng hành vi, không lặp tên method (`"Create a new category"`, không phải `"Create"`).
- **`@ApiTags()` đủ nghĩa** khi path là viết tắt (`@ApiTags('Authentication & Authorization')` cho `@Controller('auth')`); path số nhiều tự rõ (`'categories'`) thì giữ nguyên.
- **Mọi module khai tag trong `src/common/swagger/api-tags.ts`** (`name` + `description` 1 câu: quản lý gì, ràng buộc quyền đáng chú ý); controller dùng `@ApiTags(API_TAGS.X.name)`, `openapi.ts` tự `addTag` từ đó — không gõ chuỗi tag tay.
- **Ngoại lệ — endpoint hạ tầng** không dành cho client (vd. `/metrics` cho Prometheus): ẩn bằng `@ApiExcludeController()`, không cần tag.
- **Response lỗi**: dùng `@ApiErrorResponses(...)` (`src/common/swagger/api-error-responses.decorator.ts`) — body `ErrorResponseDto` khớp `AllExceptionsFilter`. Khai đúng các status route thực sự trả (400 khi có body/query/`ParseUUIDPipe`; 401+403 khi có guard; 404/409 theo service), `[status, 'mô tả']` khi cần ghi rõ nguyên nhân. **Không khai 429** ở route — `openapi.ts` tự thêm cho mọi route vì `ThrottlerGuard` là guard toàn cục.
- Khai **response `type:`** (`@ApiOkResponse({ type })`, `@ApiCreatedResponse({ type })`), không chỉ `description`. `type:` trỏ vào Response DTO.
- **Postman**: không sửa tay collection. Sau khi thêm/sửa API: `npm run start:dev` rồi `npm run postman:sync` (cần `POSTMAN_API_KEY`, `POSTMAN_COLLECTION_ID` trong `.env`). Script ghi đè toàn bộ collection.

### R9. Pagination

- **Mọi `findAll()` phân trang** bằng `PaginationDto` dùng chung (`src/common/pagination/`, kèm `PaginationMetaDto`) (`page` ≥1 mặc định 1; `limit` 1–100 mặc định 20, `@Max(100)` chặn quá tải) — kể cả resource ít bản ghi, để response shape nhất quán.
- Response envelope `{ data: [...], meta: { page, limit, total, totalPages } }`.
- **Luôn `orderBy` có tie-breaker** (vd. `[{ createdAt: 'desc' }, { id: 'desc' }]`) — thiếu thì chuyển trang có thể trùng/sót record. Cho client chọn field sort thì whitelist field.

### R10. Testing

Vitest (`vitest.config.ts` unit, `vitest.config.e2e.ts` e2e) + `supertest`.

| Loại test            | Khi nào                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Service unit test    | **Bắt buộc** nếu service có business logic (not-found, conflict, tính toán, điều kiện) — test cả nhánh lỗi           |
| API e2e test         | **Bắt buộc** cho endpoint public/quan trọng (checkout, auth, payment); khuyến nghị cho mọi CRUD                      |
| Controller unit test | **Optional** — controller mỏng chỉ xác nhận "có gọi service"; e2e mới cover route/pipe/validation/status/filter thật |

- Unit test mock dependency ở boundary của đơn vị cần kiểm tra, không kết nối DB; service unit test mock Port (Persistence Port, `TransactionRunner`) thay vì `PrismaService`.
- e2e gọi `configureApp(app)` — **không duplicate bootstrap config** giữa `main.ts` và e2e (lệch config → test pass nhưng app thật khác).
- Token ADMIN cho e2e: login 1 lần trong `beforeAll` bằng tài khoản seed (`npm run db:seed`), dùng chung cả file.
- Chạy: `npm run test` · `npm run test:e2e` · `npm run test:cov`.

## C. Business/Use-case API (non-CRUD)

Ví dụ: `POST /auth/login`, `POST /orders/:id/cancel`, `POST /cart/checkout`, `POST /payments/:id/refund`. Khác CRUD:

- **§01–04 không được rút gọn** — contract thường không map 1-1 với model DB.
- Service method đặt tên theo hành vi; không ép vào `create/update/remove`.
- Thường cần transaction + conditional atomic update (R4).
- Business rule là trọng tâm; Prisma call chỉ hiện thực hoá rule.

Ví dụ phân rã `POST /orders/:id/cancel` (minh hoạ flow, không phải spec — rule thật xem `../architecture/modules/`):

```
Business Rules  Order tồn tại; user là chủ order; status cho phép huỷ;
                đã thanh toán → hoàn tiền; cộng trả tồn kho từng item; ghi audit log
API Contract    200 { order } | 404 không tồn tại | 403 không phải chủ | 409 không huỷ được
Authorization   JWT + ownership
DB Impact       orders.status → CANCELLED; tồn kho += item.quantity; bản ghi refund (nếu có)
Idempotency /   Huỷ 2 lần phải an toàn (không 500); 2 request đồng thời → chỉ 1 thắng,
Concurrency     request kia nhận lỗi rõ ràng → conditional atomic update, không "check rồi update"
Service         OrdersService.cancelOrder(id, userId) trong $transaction; refund gọi NGOÀI transaction
```

Tên `cancelOrder()` chứ không phải `update()` — đây là hành vi nhiều điều kiện + side-effect; bắt đầu từ "update field `status`" dễ bỏ sót ownership, tồn kho, refund. Code minh hoạ: [api-crud-walkthrough.md § Phụ lục — ví dụ non-CRUD](api-crud-walkthrough.md#phụ-lục-b--ví-dụ-non-crud-cancelorder). Đừng coi transaction chạy được là xong — đối chiếu lại đủ danh sách business rule.

## Definition of Done

API chỉ hoàn tất khi business rule và authorization đã rõ, contract/documentation khớp implementation, các checklist áp dụng bên dưới đạt, và PR đã được review. Không dùng Definition of Done này thay cho checklist CRUD/non-CRUD cụ thể.

## Checklist

### CRUD resource

- [ ] Model/enum có trong `prisma/schema/` + đã `migrate dev` **và** `generate` (Prisma v7 không tự generate)
- [ ] Scaffold bằng `nest g resource` (REST, Yes CRUD entry points); xoá `entities/` và `*.spec.ts` mẫu
- [ ] DTO: validator + `@ApiProperty` + `example:`; `PartialType` từ `@nestjs/swagger` (R1)
- [ ] Param id dùng đúng pipe theo kiểu id (R1)
- [ ] Lỗi nghiệp vụ ném từ bộ lỗi chung ở service (module mới hoặc đã chuyển đổi, xem Migration status) với message nghiệp vụ; không pre-fetch chỉ để check tồn tại (R2)
- [ ] Service unit test nếu có business logic; e2e cho endpoint public/quan trọng (R10)
- [ ] Response DTO allow-list, Prisma type không ra API (R7; luồng mapper với module mới hoặc đã chuyển đổi, xem Migration status)
- [ ] Swagger: `type:`, `@ApiOperation`, `@ApiTags(API_TAGS.X.name)` (R8)
- [ ] Pagination + `@Max(limit)` + `orderBy` tie-breaker cho mọi `findAll()` (R9)
- [ ] Đã qua Authorization checkpoint (R5)
- [ ] `npm run test`, `npm run test:e2e` (nếu có), `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` đều đạt

### API nghiệp vụ (non-CRUD)

- [ ] Requirement + Business Rules viết rõ trước khi động vào DB/code
- [ ] Đã trả lời Idempotency + Concurrency (§05)
- [ ] Method service đặt tên theo hành vi
- [ ] Atomic: conditional atomic update thay vì "check rồi update"; external call **ngoài** transaction (R4; `TransactionRunner` với module mới hoặc đã chuyển đổi, xem Migration status)
- [ ] Authorization rõ — public-facing chưa có auth là **blocking**
- [ ] Đã cân nhắc audit log / business event log (§16)
