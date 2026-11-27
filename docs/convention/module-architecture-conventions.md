# Convention: kiến trúc module (mọi module trong `src/modules`)

> 📖 Xem [README.md](README.md) để biết vị trí file này trong bộ convention. Quyết định gốc: [ADR 0015](../adr/0015-one-layered-architecture-for-every-module.md). Lý do và các phương án đã loại: [map chuẩn kiến trúc toàn src](../plan/wayfinding/src-wide-architecture-standard/map.md). Bản rút gọn cho agent: [`.claude/rules/module-architecture.md`](../../.claude/rules/module-architecture.md).

Đây là **nguồn chuẩn duy nhất** cho phân tầng, vị trí file, Port/adapter, DI, lỗi, transaction và ranh giới module. Mọi module trong `src/modules` dùng **một** kiến trúc Hexagonal, không có ngoại lệ cho module nhỏ. Tiêu chí chất lượng code nằm ở [code-quality-conventions.md](code-quality-conventions.md); đặt tên file và import alias ở [coding-style-conventions.md](coding-style-conventions.md).

**Trạng thái áp dụng.** Quy tắc áp dụng đầy đủ cho module mới, feature mới và module đã chuyển đổi. Module chưa chuyển đổi giữ cấu trúc hiện tại khi sửa nhỏ, không chuyển đổi nửa chừng; danh sách module đã chuyển đổi nằm ở mục _Migration status_ của rule agent, và mỗi PR refactor cập nhật danh sách đó.

**Trạng thái triển khai.** Tài liệu này mô tả **trạng thái đích**. Các thành phần dùng chung của task 39 ([nền móng dùng chung](../plan/tasks/39-shared-architecture-foundations/spec.md)) **đã có trong repo**: bộ lỗi `src/common/errors/`, `TransactionRunner` (`src/infrastructure/database/transaction-runner.port.ts`) cùng `nestjs-cls`, và các port dùng chung (Idempotency, Mail, Storage, Audit). Chưa module nghiệp vụ nào dùng chúng; module chưa chuyển đổi giữ mẫu hiện tại cho đến task chuyển module (xem `.claude/rules/module-architecture.md`). Còn lại:

- Task 40 ([bộ sinh luật lint](../plan/tasks/40-lint-boundary-generator/spec.md)): `scripts/generate-oxlint-boundaries.ts` và việc `max-lines`/`no-restricted-imports` chặn thật.

Marker "(có từ task 39)" / "(có từ task 40)" bên dưới đánh dấu từng điểm này.

## 1. Nguyên tắc

1. Domain thuần; service ở `application/` gọi Port; mọi truy cập DB đi qua Persistence Port, adapter Prisma ở `infrastructure/`; wiring DI ở file module.
2. Cấu trúc phải dễ tìm: mỗi thành phần chỉ có một chỗ để đặt. Chỉ tạo thư mục khi có file thật, không tạo thư mục rỗng để dự phòng.
3. Không tạo abstraction (Port, mapper, service) cho logic thuần không có outbound I/O. Cái giá chấp nhận được của một bố cục duy nhất là module CRUD nhỏ có nhiều file hơn.
4. Khi refactor cấu trúc, giữ nguyên hành vi (Swagger diff rỗng).

## 2. Bộ khung thư mục

Bảng dưới là quy tắc đặt file, không phải cây của một module cụ thể. Ví dụ thật: [`src/modules/catalog/category/`](../../src/modules/catalog/category/); cây as-built của toàn `src` ở [02-modules.md §4](../architecture/02-modules.md#4-cấu-trúc-thư-mục) và `../architecture/modules/*.md`.

| Thư mục / file       | Vai trò                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `domain/`            | Domain Model (`type`/`interface` thuần), luật nghiệp vụ thuần, hằng số, enum, lỗi nghiệp vụ của module                         |
| `application/`       | Service/use case, Application Result, class công khai `<module>.service.ts`. Không lặp `application/` trong thư mục bề mặt     |
| `application/ports/` | Port mà `application/` cần: Persistence Port và port I/O riêng của module                                                      |
| `infrastructure/`    | Adapter Prisma (`prisma-<name>.repository.ts`), client bên ngoài, storage; Persistence Record và mapping Prisma → Domain Model |
| `presentation/`      | Thành phần HTTP dùng cho cả hai bề mặt: strategy, interceptor, DTO có ý nghĩa giống hệt ở hai bên                              |
| `admin/`             | Bề mặt **Back-office** (không phải Vai trò Admin): chỉ `controllers/`, `dto/`, `mappers/` và guard riêng của bề mặt            |
| `storefront/`        | Bề mặt **Storefront**: cùng cấu trúc với `admin/`                                                                              |
| `<module>.module.ts` | Composition root: provider, controller, binding Port → adapter. Không chứa logic                                               |

Quy ước thêm:

- Giữ thư mục bề mặt kể cả khi module chỉ có một bề mặt. `admin/` và tiền tố `admin-` nghĩa là bề mặt Back-office; Vai trò Admin do Quyền quyết định, không do thư mục.
- Module nhiều feature (`catalog`) lặp cùng bộ khung trong mỗi feature (`catalog/product/`, `catalog/category/`...).
- Tách Core/Admin/Storefront Nest module là quy tắc **có điều kiện**: chỉ khi module có cả hai bề mặt và mỗi bên có provider riêng đáng kể (hiện chỉ Category). Việc tách chỉ thêm file `*.module.ts`, không đổi bố cục thư mục. Mọi module khác dùng một file `*.module.ts`.
- `*.spec.ts` đặt cạnh file được test. Helper test dùng chung của một feature đặt ở `testing/` của feature đó (không đặt logic production vào đây).
- Không dùng `index.ts` (barrel); import bằng alias `#src/*` (xem coding-style §3, §4).

Trước khi tạo file, trả lời lần lượt: file giải quyết trách nhiệm gì; thuộc tầng nào; được phép import gì; có đặt được vào file hiện có không; có cần abstraction mới không; có thật sự dùng chung không.

## 3. Trách nhiệm từng tầng

- **`domain/`** không import NestJS, Prisma, HTTP, Storage hay client ngoài. Chỉ có kiểu, luật thuần và lỗi nghiệp vụ.
- **`application/`** điều phối use case bằng Domain và Port. Không import adapter, `PrismaService`, `#src/generated/**` hay `nestjs-cls`. Không import hay trả về DTO/Presentation mapper.
- **`infrastructure/`** là nơi **duy nhất** làm việc trực tiếp với Prisma Client, SDK, HTTP client. Mapping dữ liệu DB sang kiểu Application dùng thuộc adapter; chuyển lỗi kỹ thuật tại biên này.
- **`admin/`, `storefront/`, `presentation/`** là HTTP adapter: nhận request, validate DTO, gọi service, gọi mapper, trả response. Không chứa truy vấn DB, nghiệp vụ phức tạp, `PrismaService` hay quản lý transaction.

### Bốn dạng dữ liệu

Không dùng lẫn các dạng sau; chỉ tạo riêng từng kiểu khi chúng khác nhau về ý nghĩa hoặc cấu trúc.

| Dạng                   | Nơi đặt                                          | Mục đích                                                                                                          |
| ---------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Domain Model**       | `domain/`                                        | `type`/`interface` thuần, chỉ gồm field use case dùng; không class có hành vi. Adapter chuyển từ kiểu Prisma sang |
| **Application Result** | `application/`                                   | Kiểu đầu ra của use case, caller cần gì có đó; không phải DTO, không chứa kiểu Prisma                             |
| **Persistence Record** | `infrastructure/` (chỉ ở đây)                    | Dữ liệu theo schema/Prisma. Không đi qua Port, Application Result hay DTO                                         |
| **DTO**                | `admin/dto/`, `storefront/dto/`, `presentation/` | Hợp đồng ở biên API (validation, Swagger). Không dùng làm kiểu nội bộ                                             |

Luồng: Controller → service → Application Result → **controller gọi mapper** → Response DTO. Mapper thuần (không DI, không truy vấn, không nghiệp vụ); phép chuyển đổi đơn giản có thể viết thẳng ở controller. Application không gọi mapper.

## 4. Port và DI

- **Persistence Port:** mỗi module (mỗi feature với `catalog`) có **một** Persistence Port gom mọi đọc/ghi các bảng nó sở hữu; chỉ tách khi port phục vụ các nhóm use case không liên quan (Category giữ các port đã tách). Chỉ khai báo phương thức use case cần.
- **Kiểu qua Port:** Domain Model, Application-defined projection, kiểu nguyên thủy và kiểu trung lập (`Date`). Không Prisma Model/Client/Persistence Record. Port không có tham số `tx`.
- **Token DI:** `abstract class` làm cả kiểu lẫn token, bind trong file module. Không dùng `Symbol` + `interface` + `@Inject(TOKEN)`.

```ts
constructor(private readonly carts: CartRepository) {}
// cart.module.ts
{ provide: CartRepository, useExisting: PrismaCartRepository }
```

- **Port dùng chung:** Mail, Storage, AuditLog, Idempotency mỗi thứ có **một** port đặt cạnh code hạ tầng (`src/infrastructure/**/*.port.ts`, ví dụ `src/infrastructure/mail/mail.port.ts`); module không bọc lại. Prisma không có port dùng chung (chỉ adapter dùng).
- **Port riêng của module:** I/O chỉ một module dùng (Google `OAuth2Client` của identity, Translation của Category) có port trong `application/ports/` của module đó. Đặt tên theo khả năng, không gắn tên nhà cung cấp.
- **Không port** cho thư viện thuần, deterministic, không I/O (`JwtService` ký token) và cho logic nội bộ không có outbound I/O.
- Binding Port → adapter nằm ở file module sở hữu Port; không bind cùng Port ở hai nơi. Với `useExisting`, adapter phải được đăng ký và export từ module được import.
- Thành phần dùng chung toàn `src` (xem [02-modules.md §3](../architecture/02-modules.md#3-quy-tắc-phụ-thuộc)): tiện ích thuần ở `common/`, hạ tầng ở `infrastructure/`, bảo mật ở `security/`. Ba thư mục này không import `modules/`.

## 5. Xử lý lỗi

- Bộ lỗi nghiệp vụ dùng chung ở `src/common/errors/` (có từ task 39), cùng kế thừa một lớp gốc: `NotFoundError` (404), `ConflictError` (409), `InvalidInputError` (400), `UnprocessableError` (422), `UnauthenticatedError` (401), `ForbiddenError` (403).
- `domain/` và `application/` chỉ ném lỗi từ bộ này (hoặc lớp con, ví dụ `CategorySlugConflictError extends ConflictError`); **không** import HTTP exception của `@nestjs/common`.
- `AllExceptionsFilter` (`src/http/filters/all-exceptions.filter.ts`; nhánh đổi lỗi chung có từ task 39) đổi lỗi sang HTTP ở **một chỗ duy nhất**, giữ nguyên mã HTTP, `message` và shape `{ statusCode, message, requestId }`. Không viết filter/interceptor ánh xạ theo module.
- Filter vẫn đổi lỗi Prisma (`P2002`, `P2003`, `P2011`, `P2014`, `P2025`) làm lưới an toàn. Adapter chỉ tự bắt lỗi Prisma khi cần message nghiệp vụ cụ thể (ví dụ trùng slug) và đổi sang lỗi chung.
- Tầng HTTP (guard, strategy, controller trong `presentation/`, `admin/`, `storefront/`) vẫn được ném HTTP exception của NestJS.
- Response, log level và request-id: [error-logging-conventions.md](error-logging-conventions.md).

## 6. Transaction

Một cách duy nhất cho toàn app: "hộp giao dịch" dựa trên `AsyncLocalStorage`.

- Service mở giao dịch bằng `await this.transactionRunner.run(async () => { ... })` rồi gọi port/service công khai như bình thường. Adapter Prisma tự dùng client của giao dịch đang mở (nếu có), không thì dùng client thường.
- `TransactionRunner.run<T>(work: () => Promise<T>, opts?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number; maxWait?: number }): Promise<T>`: service chọn mức cô lập khi mở giao dịch (mặc định `Read Committed`); adapter nhập vào giao dịch không tự đặt isolation. Nơi gọi `run` sở hữu việc retry khi gặp `P2034`. Chỉ giao dịch ngoài cùng áp dụng `opts`.
- `TransactionRunner` (có từ task 39) là `abstract class` ở `src/infrastructure/database/transaction-runner.port.ts` (port dùng chung, khớp mẫu `*.port.js` của luật lint 2), cài đặt bằng `TransactionHost` của `@nestjs-cls/transactional` (kèm `nestjs-cls` và adapter Prisma). **Chỉ** code trong `infrastructure/` được import thư viện. Đổi thư viện sau này chỉ sửa tầng `infrastructure/`.
- **Không** truyền `tx` qua port; **không** dùng `@Transactional()` trong service (gắn `application/` vào thư viện).
- Giao dịch lồng nhau nhập vào giao dịch ngoài (propagation Required): một service công khai dùng được cả khi gọi riêng lẫn bên trong giao dịch của checkout. Không dùng `Nested`/`RequiresNew` khi chưa có quyết định riêng.
- **Không gọi ra ngoài trong `run()`:** không gửi mail, upload, gọi Google/provider. Làm sau khi giao dịch xong hoặc qua outbox ([ADR 0003](../adr/0003-inventory-reservations-and-transactional-outbox.md)). Giữ giao dịch ngắn (Prisma hủy sau 5 s mặc định).
- **Transaction xuyên module** chạy qua service công khai của từng module; không module nào ghi bảng của module khác.
- **Khoá dòng** (`SELECT ... FOR UPDATE`) nằm ở adapter của module chủ bảng; caller yêu cầu bằng `{ lockForUpdate: true }`. Thứ tự khoá và quy tắc từng luồng: [04-data-consistency.md](../architecture/04-data-consistency.md). Cú pháp Prisma: [prisma-conventions.md §4](prisma-conventions.md#4-prisma-client-trong-nestjs).

## 7. Ranh giới module và feature

- Chỉ module chủ sở hữu ghi/đọc bảng của nó (ma trận ở [02-modules.md §2](../architecture/02-modules.md#2-quyền-sở-hữu-dữ-liệu)).
- **Class công khai duy nhất:** mỗi module export đúng một class trong `application/<module>.service.ts` (`CatalogService`, `InventoryService`, `VoucherService`), chỉ chứa hàm module khác cần. Service cho bề mặt đặt tên riêng (ví dụ `admin-inventory.service.ts`) và không export. `IdentityModule` giữ exports hiện tại.
- Module A chỉ import của module B đúng hai file: `#src/modules/<b>/<b>.module.js` và `#src/modules/<b>/application/<b>.service.js`.
- Hàm công khai đặt tên theo việc nghiệp vụ, chỉ đụng bảng của module chủ, trả `type` thuần (không Prisma, không DTO), ném lỗi từ bộ lỗi chung. Không thêm hàm khi chưa có module nào cần.
- **Chiều gọi một chiều, không vòng:**

  ```text
  checkout ──> catalog, inventory, voucher, identity (guard)
  cart     ──> catalog, inventory, identity (guard)
  catalog  ──> inventory
  inventory, voucher ──> không gọi module nghiệp vụ nào
  ```

  Consumer hỏi thẳng module sở hữu dữ liệu, không nhờ module trung gian hỏi hộ. Khi module dưới cần báo ngược lên, dùng domain event qua outbox ([07-async-events-jobs.md](../architecture/07-async-events-jobs.md)).

- **Giữa các feature cùng module:** feature X chỉ được import `domain/`, `presentation/` và **đúng một file** `application/<y>.service.ts` của feature Y (service công khai của Y); không import `ports/`, `infrastructure/` hay file `application/` nào khác của Y. Cần dữ liệu của Y thì gọi service đó.
- Checkout tạm sở hữu `checkout_quotes`, `orders`, `order_items` đến khi có module `ordering`.

## 8. Giới hạn kích thước file

- Mục tiêu khoảng **150** dòng, giới hạn cứng **200** dòng mỗi file (không đếm dòng trống và comment); `max-lines` chặn (có từ task 40). Vượt thì tách theo trách nhiệm, không tách chỉ để đạt con số.
- **Miễn:** code sinh tự động (`src/generated/`) và file test (`*.spec.ts`, `*.e2e-spec.ts`). Ngoại lệ cho một file cụ thể chỉ khi có comment giải thích lý do ngay trong file.

## 9. Bộ luật lint

> Trạng thái đích: script sinh và các luật bên dưới được giao ở task 40; hiện chưa có trong repo, review thủ công theo các luật này.

Cấu hình bằng `no-restricted-imports` và `max-lines` của oxlint, sinh bởi `scripts/generate-oxlint-boundaries.ts` (có từ task 40; không sửa tay phần sinh trong `oxlint.json`).

1. `domain/` không import `@nestjs/**`, `#src/infrastructure/**`, `#src/generated/**`.
2. `application/` không import `#src/generated/**`, `PrismaService`, `nestjs-cls`/`@nestjs-cls/**`, adapter trong `infrastructure/`; chỉ được import port dùng chung `#src/infrastructure/**/*.port.js`.
3. `domain/` và `application/` không import HTTP exception của `@nestjs/common`.
4. `admin/`, `storefront/`, `presentation/` không import `PrismaService` hay `#src/generated/**`.
5. Module A chỉ import của module B hai file nêu ở §7.
6. Trong cùng module, feature X chỉ import `domain/`, `presentation/` và `application/<y>.service.js` của feature Y; cấm `ports/`, `infrastructure/` và các file `application/` khác.
7. `max-lines` 200 (bỏ dòng trống và comment; miễn `src/generated/**` và file test); cấm import tương đối `./`, `../` trong `src/` (trừ `src/generated/`) để không lách được luật 5 và 6.

**Lộ trình:** luật 1–6 mức `error` cho từng module ngay trong PR refactor module đó (script giữ danh sách module đã chuyển đổi); không dùng mức warning. Luật 7 `max-lines` mức `error` ngay, kèm danh sách tạm các file đang vượt; mỗi PR tách file xoá file khỏi danh sách. Cấm import tương đối: `error` ngay. Điều công cụ không biểu đạt được (ví dụ một Port có phải "gom nhóm use case liên quan") chỉ kiểm bằng review.

## 10. Ví dụ: Category

[`src/modules/catalog/category/`](../../src/modules/catalog/category/) là ví dụ cấu trúc nhiều tầng đầy đủ nhất: `domain/`, `application/ports/`, `infrastructure/`, `admin/`, `storefront/`, `presentation/` và Core/Admin/Storefront Nest module (một trong số ít module đủ điều kiện tách). Khi code và tài liệu khác nhau, code là sự thật; cập nhật cây ở `02-modules.md` trong cùng PR đổi cấu trúc.
