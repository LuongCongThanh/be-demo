# Convention: phát triển API trong NestJS (ecommerce project)

> 📖 Xem [README.md](README.md) để biết vị trí file này trong toàn bộ convention và thứ tự đọc.

Tài liệu này dành cho **dev trong team tự đọc và tự viết code** khi tạo 1 API/module mới trong project — không phải prompt hay tài liệu ngữ cảnh để AI agent tự sinh code (vibe coding). Đọc xong, bạn biết cách đi từ requirement tới lúc mở PR cho cả CRUD resource lẫn API nghiệp vụ, theo đúng convention hiện hành của repo.

Tài liệu này có 3 phần:

- **[A. Flow tổng quát](#a-flow-tổng-quát--áp-dụng-cho-mọi-api)** — áp dụng cho **bất kỳ API nào**: CRUD resource (`categories`, `products`...) lẫn API nghiệp vụ không-CRUD (`checkout`, `cancelOrder`, `login`, `applyCoupon`, `refundPayment`...).
- **[B. CRUD Resource Flow](#b-crud-resource-flow-trường-hợp-cụ-thể)** — bản chi tiết hoá của flow A cho trường hợp cụ thể **CRUD resource thuần** (`create/findAll/findOne/update/remove`). Viết theo khung **generic, dùng placeholder `Resource`/`resource`** — thay bằng tên thực thể thật (số ít viết hoa chữ cái đầu cho class, số nhiều viết thường cho route/thư mục, vd. `Product`/`products`) khi áp dụng cho resource cụ thể.
- **[C. Business/Use-case API Flow](#c-businessuse-case-api-flow-non-crud)** — cùng flow A nhưng áp dụng cho API nghiệp vụ, nơi tên method không phải `create/findAll/...` mà là `checkout()`, `cancelOrder()`, `applyCoupon()`...

CRUD chỉ là **một trường hợp riêng** của flow API tổng quát — đừng dùng mục B làm khuôn cho mọi endpoint; API nghiệp vụ phức tạp nên bắt đầu từ mục A rồi tham khảo mục C.

**Mục lục đầy đủ:**

- [A. Flow tổng quát](#a-flow-tổng-quát--áp-dụng-cho-mọi-api)
- [B. CRUD Resource Flow](#b-crud-resource-flow-trường-hợp-cụ-thể)
  - [B0. Requirement / Business Rules / API Contract (rút gọn cho CRUD)](#b0-requirement--business-rules--api-contract-rút-gọn-cho-crud)
  - [B1. Database impact](#b1-database-impact--model-mới-hoặc-đã-có-trong-prismaschemaschemaprisma)
  - [B2. Migration + generate Prisma Client](#b2-migration--generate-prisma-client)
  - [B3. Scaffold — cấu trúc thư mục chuẩn](#b3-scaffold--cấu-trúc-thư-mục-chuẩn)
  - [B4. Request DTO + Validation](#b4-request-dto--validation)
  - [B5. Service / Use Case](#b5-service--use-case-business-rule--prisma-call)
  - [B5b. Data access layer — khi nào cần Repository?](#b5b-data-access-layer--khi-nào-cần-repository)
  - [B5c. Transaction — khi nào atomic](#b5c-transaction--khi-nào-atomic)
  - [B6. Controller](#b6-controller)
  - [B7. Exception Mapping](#b7-exception-mapping)
  - [B8. Testing](#b8-testing)
  - [B9. Best practice khác](#b9-best-practice-khác)
  - [B10. Authorization checkpoint](#b10-authorization-checkpoint)
  - [B11. Response DTO / Serialization](#b11-response-dto--serialization)
  - [B12. Swagger / OpenAPI](#b12-swagger--openapi)
  - [B13. Pagination cho `findAll()`](#b13-pagination-cho-findall)
  - [B14. Convention — schema Prisma tách thành nhiều file](#b14-convention--schema-prisma-tách-thành-nhiều-file)
- [C. Business/Use-case API Flow (non-CRUD)](#c-businessuse-case-api-flow-non-crud)
- [Definition of Done](#definition-of-done)
- [Checklist khi tạo API mới](#checklist-khi-tạo-api-mới)
- [Phụ lục — Tổng hợp lệnh CLI cần dùng](#phụ-lục--tổng-hợp-lệnh-cli-cần-dùng)

> Tài liệu này là **convention chung, generic** — mô tả _cách_ tạo 1 API/module, không phải bản ghi chi tiết business rule của 1 resource cụ thể. Business rule, acceptance criteria và implementation sequence sống trong [Module Specifications Index](../specs/MODULE-SPECS.md).
>
> ⚠️ `../../CONTEXT.md` ở root hiện vẫn mô tả domain "Todo List" cũ, chưa khớp schema ecommerce thật (`docs/agents/domain.md` yêu cầu đọc `CONTEXT.md` trước khi code) — gap đã biết, cần task riêng để cập nhật, không xử lý trong convention này.

## A. Flow tổng quát — áp dụng cho MỌI API

Đi qua đủ 20 bước theo đúng thứ tự dưới đây khi thiết kế 1 API bất kỳ:

```
01. Requirement                     — API này giải quyết việc gì, cho ai?
02. Business Rules                  — điều kiện hợp lệ, invariant, side-effect
03. API Contract                    — method + route + request/response shape
04. Authorization Rules             — public hay cần auth? role/policy nào?
05. Idempotency / Concurrency       — retry có tạo bản ghi trùng không? có race condition không?
06. Database Impact                 — bảng nào bị đọc/ghi, có cần model mới không
07. Migration / Prisma Generate     — nếu §06 cần đổi schema
08. Scaffold Module/Resource        — nest g resource, hoặc thêm route vào module có sẵn
09. Request DTO + Validation        — class-validator, whitelist input
10. Service / Use Case              — chứa business rule ở §02
11. Data Access / Prisma            — 1 hoặc nhiều Prisma call
12. Transaction (nếu cần)           — khi cả một business operation cần atomic (không phải cứ ≥2 write là tự động cần transaction — xem §B5c)
13. Controller                      — route → validate param → delegate Service
14. Exception Mapping               — domain error → đúng HTTP status
15. Response DTO / Serialization    — field nào được phép ra ngoài
16. Logging / Audit / Metrics       — có cần log business event / audit user action không?
17. Swagger / OpenAPI                — typed request/response contract
18. Testing                          — service unit + API e2e (xem §B8/§C)
19. Lint / Format / Build            — oxlint + prettier + build sạch
20. PR                               — ship-pr skill
```

Với CRUD đơn giản, nhiều bước co lại gần như không tốn effort (vd. §01–04 chỉ 1-2 câu, §05/§12 bỏ qua vì không có retry/nhiều write rủi ro) — nhưng **thứ tự tư duy vẫn nên đi từ Requirement xuống Database, không phải ngược lại**. Bắt đầu từ "tôi cần bảng nào" dễ khiến API nghiệp vụ (`cancelOrder`, `checkout`) bị nhầm thành "update 1 field trong DB", trong khi thực chất còn kèm theo nhiều business rule không nằm trong 1 câu SQL.

**§05 Idempotency / Concurrency** — 2 câu hỏi ngắn cần tự trả lời cho mỗi API nghiệp vụ (không bắt buộc cho CRUD đơn giản):

- _Idempotency_: nếu client gọi lại API này 2 lần (do timeout/retry), có tạo ra 2 bản ghi/2 side-effect không nên có không? (`checkout`, `payment`, `refund`, webhook — cần cân nhắc `Idempotency-Key` hoặc unique constraint chống trùng)
- _Concurrency_: 2 request cùng lúc có thể cùng đọc một giá trị rồi cùng ghi đè, dẫn tới sai invariant không? Đặc biệt với `inventory`, `coupon usage`, `balance`, `order status` — nếu có, `read → check → write` (kể cả trong transaction) chưa chắc đủ; cần atomic update dạng `UPDATE ... WHERE quantity >= x` hoặc optimistic lock, không chỉ dựa vào transaction.

Cả hai chủ đề này khá sâu (outbox pattern, saga, optimistic locking...) — tài liệu này chỉ đặt câu hỏi checkpoint, chưa đi sâu kỹ thuật vì project hiện chưa có API nào thực sự cần tới; khi có (`checkout`, `payment`...) nên tách thành ADR (Architecture Decision Record — tài liệu ghi lại 1 quyết định kỹ thuật và lý do, xem `../adr`) hoặc doc riêng.

**§16 Logging / Audit / Metrics** — không phải API nào cũng cần, nhưng nên tự hỏi trước khi coi là xong: có cần log business event không (vd. `order cancelled`, `login failed`)? Có cần audit trail (ai làm gì, lúc nào) không — đặc biệt với hành động có thể tranh chấp (huỷ đơn, hoàn tiền, đổi quyền)? Có metric quan trọng cần theo dõi không (tỷ lệ lỗi checkout, thời gian xử lý payment...)? CRUD nội bộ đơn giản thường không cần gì thêm ngoài log mặc định của framework; API nghiệp vụ nhạy cảm (`checkout`, `payment`, `refund`, `cancelOrder`, `login`) nên có ít nhất audit log. Project đã có logging + request-id chuẩn hoá (xem `error-logging-conventions.md`) — audit trail chi tiết hơn (ai làm gì, lúc nào cho từng hành động nghiệp vụ) vẫn chưa có, thiết kế khi cần thay vì mỗi module tự viết log rời rạc.

---

## B. CRUD Resource Flow (trường hợp cụ thể)

Bên dưới là flow A áp dụng đầy đủ cho 1 CRUD resource, viết theo khung **generic** — dùng placeholder **`Resource`/`resource`**, thay bằng tên thực thể thật khi bắt đầu 1 resource mới (`Category`/`categories`, `Product`/`products`...).

> **Không nằm trong phạm vi mục này**: business rule cụ thể của từng resource thật (sinh slug, ownership, tính tồn kho, ADR xoá cascade/restrict...). Những nội dung đó sống trong module spec và trỏ ngược lại các mục §B0–§B14 dưới đây cho phần khung sườn dùng chung.

### B0. Requirement / Business Rules / API Contract (rút gọn cho CRUD)

Với CRUD thuần, 3 bước đầu của flow A thường chỉ là:

- Requirement: quản lý 1 loại dữ liệu nghiệp vụ (tạo/sửa/xoá/liệt kê).
- Business rule: field nào server tự sinh (không nhận từ client), field nào cần unique, quan hệ FK nào chặn xoá (cascade/restrict/set null)... — mỗi resource thật sẽ có câu trả lời khác nhau, không rập khuôn.
- API contract: `POST/GET/GET/PATCH/DELETE /resources` — chuẩn REST, request/response gần như map 1-1 với model DB (trừ field server tự sinh, không có trong request body).

→ Vì contract gần như trùng schema, có thể đi thẳng vào bước migration bên dưới. Với API nghiệp vụ (§C), 3 bước này **không được rút gọn** vì contract khác hẳn shape DB.

### B1. Database impact — model mới (hoặc đã có) trong `../../prisma/schema/schema.prisma`

Khai báo (hoặc đối chiếu) model trong `../../prisma/schema/schema.prisma` theo mẫu sau:

```prisma
model Resource {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @db.VarChar(255)
  description String?
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@map("resources")
}
```

Nếu model chưa tồn tại, thêm vào `../../prisma/schema/schema.prisma` trước. Nếu cần thêm enum mới, khai báo trong `prisma/schema/enums.prisma` (xem [convention tách schema thành nhiều file](#b14-convention--schema-prisma-tách-thành-nhiều-file)) — Prisma tự merge mọi file `.prisma` trong thư mục `prisma/schema/` khi generate/migrate, không cần import.

> Dùng `id String @default(uuid())` hay `id Int @default(autoincrement())` là quyết định theo từng resource — kiểu `id` quyết định dùng `ParseUUIDPipe` hay `ParseIntPipe` ở controller (§B6), luôn kiểm tra lại schema thật trước khi copy code mẫu.

### B2. Migration + generate Prisma Client

Chạy 2 lệnh sau để tạo bảng và sinh lại Prisma Client:

```bash
npx prisma migrate dev --name MIGRATION_NAME --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
```

> ⚠️ **Prisma v7**: `migrate dev` **không còn tự động chạy `prisma generate` hoặc seed script** (khác với Prisma v5/v6). Phải gọi `prisma generate` riêng sau khi migrate nếu cần Prisma Client mới ngay (vd. để code TypeScript nhận đúng type field mới thêm). Xem thêm [Phụ lục CLI](#phụ-lục--tổng-hợp-lệnh-cli-cần-dùng).
>
> Project cũng dùng file config tên **`../../prisma7.config.ts`** (không phải mặc định `prisma.config.ts`) — mọi lệnh `prisma` đều cần `--config prisma7.config.ts`.

(Tuỳ chọn) Seed dữ liệu mẫu: `npx prisma db seed --config prisma7.config.ts`.

> Chỉ sau khi bảng tồn tại trong DB, `PrismaService` mới `create/findMany/update/delete` được — nếu chưa migrate, mọi lời gọi CRUD sẽ lỗi kiểu `relation "xxx" does not exist`.

### B3. Scaffold — cấu trúc thư mục chuẩn

Project là ESM (`"type": "module"`) — **mọi import nội bộ phải có đuôi `.js`**, kể cả import từ file `.ts`. Cấu trúc thư mục chuẩn như sau:

```
src/
  resources/
    dto/
      create-resource.dto.ts
      update-resource.dto.ts
      pagination.dto.ts   — dùng chung shape { page, limit } cho mọi resource có findAll() phân trang (§B13)
    resources.controller.ts
    resources.service.ts
    resources.module.ts
```

> ⚠️ **Không dùng `entities/`**: `nest g resource` mặc định sinh thêm thư mục này (class đại diện response, dùng cho Swagger + `ClassSerializerInterceptor`). Convention project là **trả thẳng type Prisma sinh ra** cho resource không có field nhạy cảm — xem [B11. Response DTO / Serialization](#b11-response-dto--serialization) khi nào bắt buộc phải có entity/DTO riêng.

Luôn bắt đầu bằng CLI:

```bash
nest g resource RESOURCE_NAME   # vd. thay Resource bằng Category → nest g resource categories
```

Chọn transport **REST API**, và trả lời **Yes** cho "Would you like to generate CRUD entry points?" (chọn `No` sẽ sinh module/controller/service rỗng, không có sẵn 5 method mẫu). CLI tự tạo đủ 4 file, tự wiring `@Module`, tự đăng ký vào `AppModule`, sinh sẵn 5 method rỗng `create/findAll/findOne/update/remove`.

Sau khi CLI sinh xong, **chỉnh tay**:

1. Xoá thư mục `entities/` sinh sẵn và file `*.spec.ts` rỗng (viết lại đúng cách ở [§B8 Testing](#b8-testing))
2. Bổ sung `class-validator` + `@ApiProperty` vào DTO (CLI sinh DTO rỗng)
3. Bổ sung decorator Swagger vào controller ([§B12 Swagger](#b12-swagger--openapi))
4. Sửa import cho đúng chuẩn ESM `.js`
5. Thêm `dto/pagination.dto.ts` nếu `findAll()` cần phân trang ([§B13](#b13-pagination-cho-findall))

### B4. Request DTO + Validation

Viết `CreateResourceDto`/`UpdateResourceDto` theo mẫu sau:

```ts
// create-resource.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateResourceDto {
  @ApiProperty({ maxLength: 255, example: 'Wireless Mouse' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Ergonomic wireless mouse with USB-C charging' })
  @IsOptional()
  @IsString()
  description?: string;
}

// update-resource.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateResourceDto } from './create-resource.dto.js';

export class UpdateResourceDto extends PartialType(CreateResourceDto) {}
```

> ⚠️ Import `PartialType` từ **`@nestjs/swagger`**, không phải `@nestjs/mapped-types`. Cả hai đều làm mọi field optional, nhưng bản của `@nestjs/swagger` mới giữ đúng metadata OpenAPI (`@ApiProperty`) khi generate document — dùng `@nestjs/mapped-types` cho DTO có Swagger decorator sẽ làm lệch contract OpenAPI sinh ra.

**Bắt buộc `example:` cho mọi field trong Swagger** — request DTO (`CreateResourceDto`, field mới ở `UpdateResourceDto`), response DTO, và query DTO (kể cả `PaginationDto`) — không chỉ `description`/`maxLength`. Field chỉ trỏ tới DTO khác (object lồng, mảng object) không cần, ví dụ nằm ở DTO được trỏ tới. Lý do: Swagger UI "Try it out" tự điền request body mẫu từ `example`; thiếu nó, người gọi API (kể cả frontend dev, người ngoài team) phải tự đoán format hợp lệ (chuỗi số? enum giá trị nào? định dạng ngày?), đặc biệt sai lệch với field có ràng buộc business (email, slug, mã theo pattern...). Tham khảo `src/auth/dto/register.dto.ts` — mọi field đều có `example`.

Response cũng cần ví dụ: Swagger là tài liệu FE đọc để dựng màn hình, thiếu ví dụ response thì FE phải gọi thử API mới biết shape và format (UUID, ngày ISO, Decimal dạng string...). Dùng một bộ id mẫu thống nhất giữa các DTO (vd. `ImageResponseDto.productId` trùng `ProductResponseDto.id`) để response mẫu ăn khớp nhau. Path param (`:id`) khai `@ApiParam({ name: 'id', description, example })` trên từng route có param (không đặt ở cấp class — Swagger sẽ gắn cả vào route không có `:id`). `test/openapi-examples.e2e-spec.ts` đọc chính OpenAPI document và đỏ nếu field, query param hoặc path param nào thiếu `example`.

> Nếu 1 field do **server tự sinh** (vd. slug sinh từ tên, mã đơn tự tăng...), field đó **không** xuất hiện trong `CreateResourceDto` — client gửi field đó lên sẽ bị `ValidationPipe` global (`forbidNonWhitelisted`) từ chối 400, không bị âm thầm bỏ qua. Xem ví dụ business rule thật ở tài liệu riêng của resource đó.

### B5. Service / Use Case (business rule + Prisma call)

Viết service với đủ 5 method CRUD như sau:

```ts
// resources.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Resource } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateResourceDto } from './dto/create-resource.dto.js';
import { UpdateResourceDto } from './dto/update-resource.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createResourceDto: CreateResourceDto): Promise<Resource> {
    return this.prisma.resource.create({ data: createResourceDto });
  }

  async findAll({ page, limit }: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.resource.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], // tie-breaker, giữ thứ tự ổn định
      }),
      this.prisma.resource.count(),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<Resource> {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) {
      throw new NotFoundException(`Resource #${id} not found`);
    }
    return resource;
  }

  async update(id: string, updateResourceDto: UpdateResourceDto): Promise<Resource> {
    await this.findOne(id); // xem lưu ý bên dưới về pre-fetch
    return this.prisma.resource.update({ where: { id }, data: updateResourceDto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.resource.delete({ where: { id } });
  }
}
```

> **Về `findOne` trước `update`/`remove`**: đoạn trên chạy `SELECT` rồi mới `UPDATE`/`DELETE` — có race condition nhỏ (record bị request khác xoá giữa 2 câu lệnh, dẫn tới Prisma `P2025` khi update). Quy tắc: **không pre-fetch chỉ để xác nhận tồn tại** nếu exception filter đã map `P2025` → 404 (khi đó `update`/`delete` trực tiếp là đủ, để Prisma tự báo not-found). **Pre-fetch khi cần chính record đó để kiểm tra business rule** (ownership, status, quan hệ FK cần đếm/kiểm tra trước khi xoá...) — trường hợp đó dù sao cũng phải đọc record trước khi ghi.

> **Business-specific error message**: exception filter ở [§B7](#b7-exception-mapping) chỉ nên là _safety net_ cho lỗi Prisma không lường trước, không phải nơi định nghĩa toàn bộ domain error. Message nghiệp vụ (trùng field unique, còn record con tham chiếu...) nên được ném rõ ràng ở service (vd. `throw new ConflictException('...')` kèm message cụ thể), thay vì để rơi xuống Prisma filter (trả message chung chung dạng "Giá trị đã tồn tại cho field: x", không nói rõ do trùng gì).
>
> ⚠️ **Pre-check không thay thế unique constraint ở DB.** Nếu resource có field unique mà service tự kiểm tra trước khi ghi (vd. `findUnique` rồi mới `create`/`update` để trả message đẹp thay vì để Prisma `P2002` rơi xuống), đoạn code đó **vẫn có race condition**: 2 request gọi gần như đồng thời có thể cùng đọc ra "chưa tồn tại" rồi cùng ghi — request thứ 2 sẽ rớt xuống Prisma `P2002` chứ không rớt vào nhánh exception tự ném ở service. Coi pre-check là **UX layer** (trả message đẹp cho trường hợp thông thường), còn **unique constraint (DB) + [Exception filter §B7](#b7-exception-mapping) mới là lớp bảo vệ cuối cùng** (bắt buộc phải giữ, không được bỏ vì "đã có pre-check rồi"). Tương tự với FK: nếu service tự đếm record con trước khi xoá để trả message rõ ràng, vẫn có race nhỏ giữa lúc đếm và lúc xoá — FK constraint (`RESTRICT`/`CASCADE`) ở DB là lớp bảo vệ cuối cùng, count/pre-check chỉ là UX layer.

### B5b. Data access layer — khi nào cần Repository?

Layer thêm vào khi nghiệp vụ phức tạp lên, so với CRUD đơn giản:

```
Simple CRUD              Complex domain
Controller               Controller
   ↓                        ↓
Service                  Service / Use Case
   ↓                        ↓
Prisma                   Repository / Data Access
                             ↓
                          Prisma
```

CRUD đơn giản **không cần** tạo `ResourcesRepository` riêng — bọc `prisma.resource.findUnique(...)` vào 1 class khác chỉ tạo abstraction không giá trị. Chỉ cân nhắc tách Repository khi có: query phức tạp tái sử dụng nhiều nơi, nhiều aggregate cùng tham gia 1 nghiệp vụ, transaction lớn, hoặc cần cô lập ORM khỏi business logic (test/thay ORM). Không áp đặt Repository cho mọi resource.

### B5c. Transaction — khi nào atomic

Không áp dụng cho CRUD 1-write đơn giản. Quy tắc **không phải "cứ ≥2 write là cần transaction"** — mà là: khi cả một **business operation** phải cùng thành công/thất bại như 1 đơn vị (không được để nửa chừng), vd. tạo `Order` + `OrderItem` + trừ `Inventory`. Ngược lại, có trường hợp nhiều write độc lập không cần chung transaction, và có trường hợp chỉ 1 write nhưng đi kèm `read → check` phía trước lại cần transaction/lock để chống race condition (xem §05 Concurrency ở mục A). Dùng `prisma.$transaction`:

```ts
return this.prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: orderData });
  await tx.orderItem.createMany({ data: items });
  await tx.inventory.updateMany({/* ... */});
  return order;
});
```

Xem ví dụ đầy đủ hơn ở [§C — Cancel Order](#c-businessuse-case-api-flow-non-crud).

### B6. Controller

Viết controller map đúng HTTP method sang route như sau:

```ts
// resources.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ResourcesService } from './resources.service.js';
import { CreateResourceDto } from './dto/create-resource.dto.js';
import { UpdateResourceDto } from './dto/update-resource.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';

@ApiTags('resources')
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  // Write (create/update/remove) → tái sử dụng nguyên bộ guard đã build ở Auth
  // module khi resource cần bảo vệ (không phải mọi resource là public).
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new resource' })
  @ApiCreatedResponse({ description: 'Tạo thành công' })
  create(@Body() createResourceDto: CreateResourceDto) {
    return this.resourcesService.create(createResourceDto);
  }

  // Read → public nếu resource không cần bảo vệ, bỏ guard.
  @Get()
  @ApiOperation({ summary: 'List resources (paginated)' })
  @ApiOkResponse({ description: 'Danh sách resource' })
  findAll(@Query() pagination: PaginationDto) {
    return this.resourcesService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a resource by id' })
  @ApiOkResponse({ description: 'Chi tiết 1 resource' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.resourcesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a resource' })
  @ApiOkResponse({ description: 'Cập nhật thành công' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateResourceDto: UpdateResourceDto) {
    return this.resourcesService.update(id, updateResourceDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a resource' })
  @ApiNoContentResponse({ description: 'Xoá thành công' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.resourcesService.remove(id);
  }
}
```

> Import path của guard/decorator (`../auth/guards/...`, `../auth/decorators/...`) giả định resource nằm ngay dưới `../../src` (`src/resources/`, cùng cấp với `src/auth/`) — đúng với cấu trúc scaffold ở [§B3](#b3-scaffold--cấu-trúc-thư-mục-chuẩn). Nếu resource không cần bảo vệ (public toàn bộ), bỏ hẳn `@UseGuards`/`@Roles`/`@ApiBearerAuth` — không phải mọi resource đều cần admin-only write.

| HTTP             | Method                    | Ý nghĩa                                            |
| ---------------- | ------------------------- | -------------------------------------------------- |
| POST             | `create()`                | Tạo mới                                            |
| GET              | `findAll()` / `findOne()` | Đọc danh sách / đọc 1                              |
| PATCH (hoặc PUT) | `update()`                | PATCH = cập nhật một phần, PUT = thay thế toàn bộ  |
| DELETE           | `remove()`                | Xóa (trả `204 No Content`, không có response body) |

> Model dùng `id String @default(uuid())` → dùng `ParseUUIDPipe`. Với resource khác dùng `id Int @default(autoincrement())` thì đổi sang `ParseIntPipe` — luôn kiểm tra kiểu `id` thật trong schema trước khi copy.

### B7. Exception Mapping

Prisma ném `PrismaClientKnownRequestError` (`P2002` = unique constraint, `P2003` = foreign key constraint, `P2025` = record không tồn tại...). Không bắt thì NestJS trả `500` cho mọi lỗi DB. Project đã có `AllExceptionsFilter` (`../../src/common/filters/all-exceptions.filter.ts`, đăng ký global qua `APP_FILTER` trong `app.module.ts`) xử lý sẵn 3 mã Prisma trên **cùng lúc** với `HttpException` và lỗi không lường trước khác — không cần tự viết filter riêng cho resource mới, chi tiết đầy đủ (response shape, quy tắc log) xem `convention/error-logging-conventions.md`. Filter này là **safety net cho lỗi không lường trước**, không thay thế domain error đã biết trước (xem lưu ý ở [§B5](#b5-service--use-case-business-rule--prisma-call)).

### B8. Testing

Project dùng **Vitest** (`../../vitest.config.ts` unit, `vitest.config.e2e.ts` e2e) + `supertest`.

**Chiến lược ưu tiên** (đảo lại so với "mọi resource phải có unit test controller"):

| Loại test            | Bắt buộc khi nào                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service unit test    | **Bắt buộc nếu service có business logic** (validate, tính toán, điều kiện)                                                                                                                                                           |
| API e2e test         | **Bắt buộc cho public endpoint / endpoint quan trọng** (checkout, auth, payment...) — và khuyến nghị cho mọi CRUD                                                                                                                     |
| Controller unit test | **Optional** — controller mỏng (chỉ `return this.service.x()`) thì test này chỉ xác nhận "controller có gọi service", không xác nhận route/pipe/validation/status code/filter có chạy đúng không. e2e đã cover việc đó tốt hơn nhiều. |

Lý do đảo: 1 controller mỏng như `findAll() { return this.resourcesService.findAll(); }` — unit test kiểu `expect(serviceMock.findAll).toHaveBeenCalled()` có giá trị thấp, không phát hiện được lỗi route, `ValidationPipe`, `ParseUUIDPipe`, exception filter, hay serialization sai. e2e test chạy qua toàn bộ pipeline thật (`HTTP → Pipe → Controller → Service → Prisma → Response`) nên đáng tin hơn cho đúng những thứ controller test không cover được.

#### a. Unit test cho Service — mock `PrismaService`

Mock `PrismaService` và test riêng logic service, không chạm DB thật:

```ts
// resources.service.spec.ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourcesService } from './resources.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ResourcesService', () => {
  let service: ResourcesService;
  const prismaMock = {
    resource: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ResourcesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(ResourcesService);
    vi.clearAllMocks();
  });

  it('findOne ném NotFoundException khi không tìm thấy', async () => {
    prismaMock.resource.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('create gọi prisma.resource.create với đúng data', async () => {
    const dto = { name: 'Học NestJS' };
    prismaMock.resource.create.mockResolvedValue({ id: '1', ...dto });
    const result = await service.create(dto as any);
    expect(prismaMock.resource.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual({ id: '1', ...dto });
  });
});
```

> Khi service có business rule riêng (unique check, tính toán, điều kiện xoá...), test thêm case cho nhánh đó — vd. `create` ném `ConflictException` khi trùng field unique, `remove` ném `ConflictException` khi còn record con tham chiếu. Xem ví dụ thật ở tài liệu riêng của resource đó.

#### b. API e2e test — gọi thật qua HTTP (`supertest`)

Gọi thật qua toàn bộ pipeline `HTTP → Pipe → Controller → Service → Prisma → Response` như sau:

```ts
// test/resources.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';

describe('Resources (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app); // dùng chung config với main.ts — xem lưu ý bên dưới
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /resources (không có Bearer token) trả 401', async () => {
    await request(app.getHttpServer()).post('/resources').send({ name: 'x' }).expect(401);
  });

  it('POST /resources tạo mới và trả 201 (ADMIN)', async () => {
    const res = await request(app.getHttpServer())
      .post('/resources')
      .set('Authorization', `Bearer ${adminAccessToken}`) // xem lưu ý bên dưới về seed/login trong e2e
      .send({ name: `Resource ${Date.now()}` })
      .expect(201);

    expect(res.body).toMatchObject({ name: expect.stringContaining('Resource') });
  });

  it('POST /resources với body thiếu field bắt buộc trả 400', async () => {
    await request(app.getHttpServer())
      .post('/resources')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({})
      .expect(400);
  });

  it('GET /resources/:id trả 404 khi không tồn tại', async () => {
    await request(app.getHttpServer()).get('/resources/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('GET /resources/:id với id không phải UUID trả 400', async () => {
    await request(app.getHttpServer()).get('/resources/not-a-uuid').expect(400);
  });
});
```

> **`adminAccessToken` trong ví dụ e2e trên**: lấy bằng cách login qua `POST /api/v1/auth/login` với tài khoản `MASTER_ADMIN` do test fixture/seed tạo, thực hiện 1 lần trong `beforeAll` và lưu vào biến dùng chung cho cả file test — không tạo lại user/login ở từng test case.

> **Không duplicate bootstrap config giữa `main.ts` và e2e setup.** Nếu `main.ts` khai báo `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` nhưng e2e chỉ set `{ whitelist: true, transform: true }`, test có thể pass trong khi app thật xử lý khác (vd. field lạ: e2e không set `forbidNonWhitelisted` nên không phát hiện được nếu app thật lẽ ra phải trả 400). Tách phần config chung ra 1 hàm dùng lại ở cả 2 chỗ:
>
> ```ts
> // src/bootstrap/configure-app.ts
> import { INestApplication, ValidationPipe } from '@nestjs/common';
>
> export function configureApp(app: INestApplication) {
>   app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
> }
> ```
>
> `AllExceptionsFilter` (§B7) đăng ký riêng qua `APP_FILTER` trong `app.module.ts`, không qua `configureApp()` — vì nó cần chạy trong Nest DI container (đọc `RequestContext`), không phải instantiate tay như `ValidationPipe`.
>
> ```ts
> // main.ts
> configureApp(app);
> ```
>
> ✅ **Đã có sẵn**: `../../src/bootstrap/configure-app.ts` đã tồn tại và đã wiring vào `main.ts` (`configureApp(app)`) — dùng lại trực tiếp trong e2e setup như ví dụ trên, không cần tạo mới.

Chạy: `npm run test` (unit) · `npm run test:e2e` (e2e) · `npm run test:cov` (coverage).

### B9. Best practice khác

- **ValidationPipe global** đã bật trong `main.ts` (qua `configureApp()`, dùng chung `main.ts` + e2e): `whitelist`, `forbidNonWhitelisted`, `transform`.
- Ném lỗi bằng `NotFoundException`, `BadRequestException`, `ConflictException`... để trả đúng HTTP status — kết hợp exception filter (§B7) cho lỗi tầng DB không lường trước.
- Service không phụ thuộc `Request`/`Response` của Express — giữ logic thuần, dễ test.
- Đặt tên method service theo convention `create/findAll/findOne/update/remove` cho CRUD; API nghiệp vụ dùng tên mô tả hành vi (xem [§C](#c-businessuse-case-api-flow-non-crud)).
- **Đọc biến môi trường qua `ConfigService`**, không đọc thẳng `process.env` — kèm validate lúc startup (fail-fast nếu thiếu/sai biến bắt buộc). Xem chi tiết ở `config-environment-conventions.md`.

### B10. Authorization checkpoint

Trước khi coi 1 endpoint là "xong", tự hỏi:

```
Endpoint có cần authentication không?
        ↓ có
   Auth Guard (JWT...)
        ↓
Endpoint có cần authorization (role/ownership) không?
        ↓ có
   Role/Policy Guard
```

> ✅ **Auth module đã xong** (`JwtAuthGuard`, `RolesGuard`, `OwnershipGuard`, `@Roles()`, `@CurrentUser()` — xem [`../specs/01-auth.md`](../specs/01-auth.md)). Mọi resource mới tái sử dụng authentication/RBAC foundation này; authorization rule cụ thể vẫn thuộc module domain. Route public có query flag chỉ staff được bật (vd. `?includeAllVariants=true`) dùng `StaffQueryFlagGuard('<flag>')` + `@QueryFlag('<flag>')` (`src/auth/guards/staff-query-flag.guard.ts`, `src/common/query-flag.ts`) — không tự viết guard kiểm role riêng. Với resource có khái niệm chủ sở hữu, dùng ownership policy đã được spec của module định nghĩa.
>
> Áp dụng checklist này cho **từng resource mới khi thực sự implement**. Trạng thái canonical nằm ở [`../README.md`](../README.md), không suy ra từ checkbox của plan.

### B11. Response DTO / Serialization

Nguyên tắc chung: **Database Model ≠ API Response Contract.**

Resource không có field nhạy cảm có thể trả thẳng Prisma type sinh ra — chấp nhận được cho resource nhỏ, ít thay đổi. Nhưng khi model có field không được lộ ra ngoài (vd. `User.passwordHash`, các `tokenHash` trong `RefreshToken`/`PasswordResetToken`), có 2 cách:

**a. Blacklist (`ClassSerializerInterceptor` + `@Exclude()`)** — nhanh, ít code, nhưng rủi ro: field mới thêm vào model sau này mặc định **được lộ ra** trừ khi nhớ thêm `@Exclude()`. Đánh dấu field cần ẩn như sau:

```ts
import { Exclude } from 'class-transformer';

export class ResourceEntity {
  id: string;
  name: string;

  @Exclude()
  internalNote: string;
}
```

Bật global trong `main.ts`:

```ts
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

**b. Allow-list (Response DTO riêng, map thủ công từ Prisma result)** — verbose hơn, nhưng an toàn hơn: field mới thêm vào model **không tự động lộ ra** cho tới khi chủ động thêm vào DTO. Khai field được phép trả về như sau:

```ts
export class ResourceResponseDto {
  id: string;
  name: string;
  description: string | null;
}
```

→ **Khuyến nghị**: dùng allow-list (Response DTO) cho model có field nhạy cảm hoặc thường xuyên thêm field mới (`User`, `Order`...); blacklist (`@Exclude`) chấp nhận được cho resource nhỏ, ổn định. Khi dùng Response DTO, khai `type:` tương ứng trong Swagger (mục dưới) để OpenAPI phản ánh đúng contract, không phải shape DB.

### B12. Swagger / OpenAPI

Swagger đã bật sẵn trong `main.ts`, xem tại `http://localhost:3000/api`.

**`@ApiTags()`: đặt tên đầy đủ ý nghĩa, không chỉ viết tắt/path trần.** Với resource CRUD đơn giản, tên path số nhiều (`@ApiTags('resources')`) đã đủ rõ nghĩa. Nhưng với module mà tên path là viết tắt hoặc không tự giải thích được (vd `auth`), dùng tên đầy đủ cho tag để người đọc Swagger UI (kể cả người ngoài team) hiểu ngay nhóm route này làm gì, không phụ thuộc phải đọc code:

```ts
@ApiTags('Authentication & Authorization') // không dùng 'auth' trần
@Controller('auth') // path URL giữ nguyên, không đổi theo tag
export class AuthController { ... }
```

**Bắt buộc khai `DocumentBuilder.addTag(name, description)` ở `main.ts` cho mọi module** — không chỉ khi "cần mô tả thêm". `@ApiTags()` chỉ cho 1 cái tên nhóm (title); `description` là câu tóm tắt module đó làm gì, hiển thị ngay đầu nhóm route trong Swagger UI, giúp người đọc (kể cả người ngoài team) hiểu phạm vi module mà không cần mở từng route. `name` truyền vào `addTag()` phải khớp **chính xác** chuỗi đã khai ở `@ApiTags()` (phân biệt hoa/thường, dấu cách) — lệch tên thì Swagger UI hiển thị nhóm đó không có mô tả, không báo lỗi:

```ts
// src/main.ts
const config = new DocumentBuilder()
  .addTag(
    'Authentication & Authorization',
    'Register, email verification, login/refresh/logout, and role/ownership-based access control',
  )
  .addTag('Categories', 'Product category CRUD — writes gated to STORE_MANAGER/MASTER_ADMIN, reads public')
  .build();
```

> Nếu resource CRUD đơn giản chỉ dùng path số nhiều trần làm tag (`@ApiTags('resources')`), description vẫn bắt buộc — 1 câu ngắn nói rõ resource đó quản lý gì và có ràng buộc quyền gì đáng chú ý (public/protected, role nào), không cần dài dòng như module nghiệp vụ phức tạp (`auth`).

**`@ApiOperation({ summary: '...' })`: bắt buộc cho mọi route, không chỉ resource CRUD đơn giản.** Tên route + HTTP method (`POST /categories`) không tự nói lên nghiệp vụ thật (vd. route trả 404 hay 200 khi rỗng? side-effect nào xảy ra? ai được gọi?). `summary` là 1 câu ngắn ở thì mệnh lệnh, mô tả đúng hành vi — không lặp lại tên method (`create()` → không viết summary là `"Create"`, mà là `"Create a new category"` hoặc cụ thể hơn nếu có business rule đáng chú ý):

```ts
@Post()
@ApiOperation({ summary: 'Register a new CUSTOMER account' })
create(@Body() dto: CreateResourceDto) { ... }

@Post('verify-email')
@ApiOperation({ summary: 'Verify email address using the 6-digit code sent by email' })
verify(@Body() dto: VerifyEmailDto) { ... }
```

> Tham khảo `src/auth/auth.controller.ts` — mọi route đều có `@ApiOperation`. Đây là pattern đã tồn tại từ module đầu tiên trong repo; convention này chỉ ghi lại nó thành yêu cầu tường minh để resource mới (scaffold theo §B3) không bị rơi mất.

Ngoài mô tả bằng `description` (đủ cho người đọc), nên khai **response type** để OpenAPI document biết chính xác shape trả về — phục vụ generate client/type cho frontend, contract testing:

```ts
@Post()
@ApiCreatedResponse({ type: ResourceResponseDto })
create(@Body() dto: CreateResourceDto) { ... }

@Get(':id')
@ApiOkResponse({ type: ResourceResponseDto })
findOne(@Param('id', ParseUUIDPipe) id: string) { ... }
```

Không bắt buộc phải có `ResourceResponseDto` riêng nếu resource trả thẳng Prisma type (§B11.a) — khi đó `type:` có thể trỏ vào 1 class khai lại field cho Swagger đọc (Prisma type không tự mang metadata OpenAPI).

**Đồng bộ sang Postman:** không tạo/sửa request thủ công trong Postman collection. Swagger (`/api-json`) là nguồn chuẩn duy nhất — sau khi thêm/sửa API (đủ decorator Swagger ở trên), chạy:

```bash
npm run start:dev                # app phải đang chạy để có /api-json
npm run postman:sync             # fetch OpenAPI spec → convert → PUT lên Postman collection
```

Cần set `POSTMAN_API_KEY` và `POSTMAN_COLLECTION_ID` trong `../../.env` (xem `.env.example`). Script ở `scripts/sync-postman-collection.ts`, ghi đè toàn bộ nội dung collection trên Postman bằng spec hiện tại — không dùng cho collection có chứa request/example thủ công cần giữ lại.

### B13. Pagination cho `findAll()`

Khai `PaginationDto` dùng chung cho mọi resource có `findAll()` phân trang như sau:

```ts
// dto/pagination.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // chặn client gọi ?limit=1000000 làm quá tải DB
  limit: number = 20;
}
```

Response nên bọc trong envelope có `meta` thay vì trả mảng trần, để client biết tổng số trang:

```ts
// resources.controller.ts
@Get()
@ApiOperation({ summary: 'List resources (paginated)' })
@ApiOkResponse({ description: 'Danh sách resource' })
findAll(@Query() pagination: PaginationDto) {
  return this.resourcesService.findAll(pagination);
}
```

> **Pagination luôn phải đi cùng deterministic ordering** (`orderBy` có tie-breaker, vd. `[{ createdAt: 'desc' }, { id: 'desc' }]`). Không set `orderBy` thì thứ tự trả về không đảm bảo ổn định giữa các lần gọi (đặc biệt khi có insert/delete xen giữa) — người dùng chuyển trang có thể thấy record trùng lặp hoặc bị bỏ sót. Nếu cho phép client chọn field sort, whitelist rõ field nào được phép thay vì nhận thẳng tên field từ query string.

Response envelope có dạng:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

Áp dụng khi resource dự kiến nhiều bản ghi (`Product`, `Order`...). Với resource ít bản ghi, pagination **vẫn nên được áp dụng** dù không thật sự cần thiết về hiệu năng — mục tiêu là giữ shape response nhất quán giữa mọi resource (client không phải xử lý 2 kiểu response khác nhau tuỳ resource).

### B14. Convention — schema Prisma tách thành nhiều file

Project dùng **multi-file schema** của Prisma (từ bản v6.7+, ổn định ở v7 project đang dùng), không còn 1 file `prisma/schema.prisma` duy nhất:

```
prisma/
  schema/
    schema.prisma   — generator, datasource, và toàn bộ model
    enums.prisma    — toàn bộ enum
  migrations/
  seed.ts
```

- `../../prisma7.config.ts` trỏ `schema: "prisma/schema"` (thư mục, không phải 1 file) — Prisma tự merge mọi file `.prisma` trong thư mục này khi `validate`/`generate`/`migrate`, không cần khai báo import giữa các file.
- **Model** → thêm vào `../../prisma/schema/schema.prisma`.
- **Enum** → thêm vào `../../prisma/schema/enums.prisma`.
- Lý do tách: enum là khai báo tĩnh (list giá trị), không có logic, tách riêng giúp mục lục file gọn và dễ tìm khi schema phình to nhiều model — không phải bug hay yêu cầu bắt buộc của Prisma, chỉ là convention tổ chức file của project này.
- `generator client { output = "../../src/generated/prisma" }` — path `output` tính từ vị trí file `schema.prisma` (tức `../../prisma/schema/schema.prisma`), nên có 2 cấp `../..` chứ không phải 1 cấp như khi còn 1 file `prisma/schema.prisma`.
- Mọi lệnh CLI (`prisma validate`, `generate`, `migrate dev`, `format`...) không đổi cú pháp — chỉ cần `--config prisma7.config.ts` như cũ (xem [Phụ lục](#phụ-lục--tổng-hợp-lệnh-cli-cần-dùng)).

---

## C. Business/Use-case API Flow (non-CRUD)

Áp dụng flow A cho API **không phải CRUD resource** — tên method mô tả hành vi nghiệp vụ, không phải `create/findAll/findOne/update/remove`. Ví dụ: `POST /auth/login`, `POST /orders/:id/cancel`, `POST /cart/checkout`, `POST /coupons/apply`, `POST /users/change-password`, `POST /payments/:id/refund`.

Khác biệt chính so với mục B:

- **§01–04 (Requirement/Business Rules/Contract/Authorization) không được rút gọn** — đây là phần quan trọng nhất, vì request/response shape thường không map trực tiếp vào 1 model DB.
- **Service method đặt tên theo hành vi** (`checkout()`, `cancelOrder()`, `applyCoupon()`), không theo `create/update`.
- **Thường cần transaction** (§B5c) vì phải ghi nhiều bảng atomic.
- **Business rule là trọng tâm**, Prisma call chỉ là bước cuối để hiện thực hoá rule đó.

Ví dụ minh hoạ — `POST /orders/:id/cancel` (chưa implement trong `../../src`, chỉ minh hoạ flow):

```
Requirement
  Huỷ 1 order khi khách đổi ý, trước khi giao hàng
↓
Business Rules
  Order phải tồn tại
  User gọi API phải là chủ order (ownership)
  Order phải đang ở status PENDING (không huỷ được order đã PAID/CANCELLED)
  Nếu đã thanh toán → phải hoàn tiền trước khi chuyển status
  Tồn kho (Inventory) của từng OrderItem phải được cộng trả lại
  Ghi audit log
↓
API Contract
  POST /orders/:id/cancel → 200 { order: OrderResponseDto }
                          → 404 nếu order không tồn tại
                          → 403 nếu không phải chủ order
                          → 409 nếu order không ở trạng thái huỷ được
↓
Authorization
  Cần auth (JWT), user phải là owner của order
↓
Database Impact
  orders.status: PENDING → CANCELLED
  inventory.quantity: += orderItem.quantity (từng item)
  (nếu đã trả phí) payments hoặc refund record
↓
Idempotency / Concurrency
  Huỷ order 2 lần (double-click/retry) phải là no-op an toàn, không lỗi 500
  Nếu 2 request huỷ cùng lúc → chỉ 1 request được thắng, request kia nhận lỗi rõ ràng
  (KHÔNG đủ nếu chỉ "check status rồi update" trong transaction — xem lưu ý bên dưới,
  cần conditional atomic update)
↓
Service (OrdersService.cancelOrder)
  return this.prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id },
      include: { items: true }, // cần include quan hệ mới đọc được order.items
    });
    // check ownership (order.userId === userId) — ném ForbiddenException nếu sai

    // TODO: nếu order đã thanh toán, gọi refund TRƯỚC/SAU transaction (xem lưu ý bên dưới)
    // TODO: ghi audit log (ai huỷ, lúc nào, lý do)

    // Conditional atomic update: điều kiện status nằm ngay trong WHERE, không tách riêng
    // bước "findOne kiểm tra status" rồi "update" — tránh race condition giữa 2 request
    // cùng huỷ 1 order (2 transaction đọc PENDING cùng lúc trước khi 1 bên commit).
    const result = await tx.order.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    if (result.count === 0) {
      throw new ConflictException('Order không ở trạng thái có thể huỷ');
    }

    for (const item of order.items) {
      await tx.inventory.update({
        where: { variantId: item.variantId },
        data: { quantity: { increment: item.quantity } },
      });
    }
    return order;
  });
↓
Controller
  @Post(':id/cancel')
  cancelOrder(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.ordersService.cancelOrder(id, user.id);
  }
```

Method tên `cancelOrder()`, không phải `update()` — vì nó không phải "sửa 1 field", mà là 1 hành vi nghiệp vụ có nhiều điều kiện + side-effect. Đây là điểm khác biệt cốt lõi so với CRUD ở mục B, và là lý do flow A đặt Requirement/Business Rules lên trước Database — nếu bắt đầu từ "tôi cần update field `status`" sẽ dễ bỏ sót ownership check, tồn kho, hay refund.

> ⚠️ **Pseudo-code trên chưa implement refund và audit log** (chỉ đánh dấu `TODO` đúng vị trí) — 2 việc này nằm trong business rule đã liệt kê ở trên nhưng **không nên tự động coi là "đã xong" chỉ vì transaction chạy được**. Đọc code minh hoạ cùng với danh sách business rule, đừng copy nguyên transaction rồi nghĩ là đủ.
>
> ⚠️ **External call (refund qua Stripe/payment gateway, gửi email...) không nên nằm bên trong `$transaction`.** `$transaction` chỉ đảm bảo atomicity ở tầng database — giữ transaction mở trong lúc gọi API bên ngoài (network chậm/timeout) sẽ giữ lock/connection DB lâu, và nếu external call thành công nhưng DB rollback sau đó (hoặc ngược lại) thì **không có gì tự động đồng bộ lại 2 bên**. Với refund/payment nên gọi external API **ngoài** transaction (trước hoặc sau, tuỳ nghiệp vụ), rồi ghi lại kết quả (thành công/thất bại) vào DB ở bước riêng. Khi nghiệp vụ này thực sự cần làm, tìm hiểu thêm outbox pattern / saga — chưa cần đưa sâu vào convention hiện tại vì project chưa có nghiệp vụ nào tới mức đó.

> Ví dụ trên minh hoạ flow, **chưa có module `orders`/`auth` nào tồn tại trong `../../src` hiện tại** — khi thực sự implement, đối chiếu lại với schema thật (`Order`, `OrderItem`, `Inventory` trong `../../prisma/schema/schema.prisma`) và áp dụng đúng auth guard một khi guard đó đã được xây dựng (xem [§B10](#b10-authorization-checkpoint)).
>
> Khi project thực sự có API xử lý payment/refund thật (không còn là ví dụ minh hoạ), nên tách chủ đề **external side effects / outbox / saga / idempotency-key thực thi** thành 1 ADR riêng (`../adr`) thay vì tiếp tục mở rộng convention này — tài liệu này nên dừng ở mức "biết để hỏi đúng câu hỏi", không phải nơi định nghĩa chi tiết kỹ thuật cho từng pattern.

---

## Definition of Done

Một API được coi là **xong**, không phải "code chạy được", khi tất cả các mục sau đều đúng:

- Requirement + Business Rules đã rõ ràng, không còn giả định ngầm
- Authorization đã được xác định (kể cả khi kết luận là "public, không cần auth")
- DTO validate đầy đủ input, không dựa vào giả định client gửi đúng
- Lỗi được map đúng HTTP status (không rơi vào `500` cho case đã biết trước)
- Response contract rõ ràng — không rò field nhạy cảm không cố ý
- Test pass: service unit test (nếu có business logic) + e2e (nếu là endpoint public/quan trọng)
- Swagger phản ánh đúng request/response thật (có `type:`, không chỉ `description`), mỗi route có `@ApiOperation({ summary })`, mọi field DTO (request, response, query) có `example:` (`test/openapi-examples.e2e-spec.ts` kiểm tự động), module có tag title + description khớp nhau giữa `@ApiTags()` và `main.ts` `addTag()` (xem [§B12](#b12-swagger--openapi))
- `npm run lint` + `npm run format` + `npm run build` sạch
- PR đã mở, review xong (`ship-pr` skill)

Checklist chi tiết bên dưới là cách để đạt Definition of Done này, không phải mục tiêu độc lập.

## Checklist khi tạo API mới

### CRUD resource

- [ ] Model (hoặc enum) đã có trong `../../prisma/schema/schema.prisma` (hoặc `prisma/schema/enums.prisma`) + đã `migrate dev` + `generate` (2 lệnh riêng — Prisma v7 không tự generate)
- [ ] Sinh khung bằng `nest g resource RESOURCE_NAME` (chọn REST API, Yes cho CRUD entry points)
- [ ] Xoá `entities/` sinh sẵn, xoá/viết lại `*.spec.ts` mẫu
- [ ] DTO có đủ `class-validator` + `@ApiProperty`/`@ApiPropertyOptional`, có `example:` cho mọi field (request, response, query); `UpdateDto` dùng `PartialType` từ **`@nestjs/swagger`**
- [ ] Param id dùng đúng pipe (`ParseUUIDPipe`/`ParseIntPipe` theo đúng kiểu trong schema)
- [ ] Business error đã biết trước (vd. trùng field unique) ném exception có message nghiệp vụ ở service, không phó mặc cho Prisma filter
- [ ] Service unit test — bắt buộc nếu service có business logic (not-found, conflict, tính toán...); service chỉ gọi thẳng Prisma không rẽ nhánh thì có thể bỏ qua
- [ ] API e2e test cho endpoint public/quan trọng — bắt buộc; cho CRUD thường — khuyến nghị
- [ ] Response DTO (allow-list) nếu model có field nhạy cảm; `@Exclude` chấp nhận được cho resource nhỏ ổn định
- [ ] Swagger có `type:` cho response (`@ApiOkResponse`/`@ApiCreatedResponse`), không chỉ `description`
- [ ] Mỗi route có `@ApiOperation({ summary: '...' })` mô tả đúng hành vi, không lặp lại tên method (xem [§B12](#b12-swagger--openapi))
- [ ] `@ApiTags()` đủ nghĩa nếu tên path là viết tắt/không tự giải thích; `main.ts` có `addTag(name, description)` khớp tên với `@ApiTags()`, mọi module đều phải có (xem [§B12](#b12-swagger--openapi))
- [ ] Pagination + `@Max(limit)` cho mọi `findAll()` — kể cả resource ít bản ghi, để giữ response shape nhất quán (xem [§B13](#b13-pagination-cho-findall))
- [ ] Đã đi qua [Authorization checkpoint](#b10-authorization-checkpoint)
- [ ] `npm run test` (unit) pass
- [ ] `npm run test:e2e` pass (nếu có viết e2e)
- [ ] `npm run lint` + `npm run format` sạch
- [ ] `npm run build` chạy được, không lỗi type

### API nghiệp vụ (non-CRUD)

- [ ] Đã viết rõ Requirement + Business Rules trước khi động vào DB/code (không rút gọn)
- [ ] Đã trả lời câu hỏi Idempotency (retry có an toàn không) và Concurrency (2 request cùng lúc có sai invariant không) — xem §05 mục A
- [ ] Method service đặt tên theo hành vi, không gượng ép vào `create/update/remove`
- [ ] Business operation cần atomic → dùng conditional atomic update (`updateMany` + kiểm tra `count`) thay vì "check rồi update" riêng lẻ; external call (payment, email...) đặt **ngoài** transaction
- [ ] Authorization checkpoint đã trả lời rõ — nếu endpoint public-facing và **chưa có auth**, coi là gap **blocking**, không ship
- [ ] Đã tự hỏi có cần audit log / business event log cho hành động này không (đặc biệt hành động có thể tranh chấp)

### Gap toàn app (đã biết — phân loại blocking/non-blocking)

| Gap                                                                   | Mức độ                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `../../CONTEXT.md` mô tả domain "Todo" cũ, chưa khớp schema ecommerce | Non-blocking cho việc code, nhưng gây nhầm domain nếu không đọc kỹ trước |

> Gap đã fix (`../../src/bootstrap/configure-app.ts` dùng chung giữa `main.ts`/e2e, `AuthModule` + guard) đã được xoá khỏi bảng này để tránh đọc nhầm thành chưa xong. Trạng thái implementation thực tế nằm ở [`../README.md`](../README.md); không suy luận từ convention doc hoặc checkbox plan.

---

## Phụ lục — Tổng hợp lệnh CLI cần dùng

> ⚠️ Project dùng file config **`../../prisma7.config.ts`** — mọi lệnh `prisma` đều cần thêm `--config prisma7.config.ts`.

Mỗi lệnh dưới đây có 2 cột: **Tác dụng** (lệnh này làm gì) và **Khi nào dùng** (thời điểm/bối cảnh nên gọi nó trong quá trình tạo API — đối chiếu với các bước §B0–§B14 ở trên).

### a. Nest CLI

| Lệnh                                                            | Tác dụng                                                                                                                | Khi nào dùng                                                                                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nest g resource RESOURCE_NAME`                                 | Sinh đủ 4 file (module/controller/service/DTO), tự wiring `@Module`, tự đăng ký vào `AppModule`, sinh sẵn 5 method rỗng | Bước [§B3 Scaffold](#b3-scaffold--cấu-trúc-thư-mục-chuẩn) — **luôn bắt đầu 1 resource CRUD mới bằng lệnh này**, chọn REST API + Yes cho CRUD entry points |
| `nest g module RESOURCE_NAME`                                   | Chỉ sinh 1 file `RESOURCE_NAME.module.ts` + tự đăng ký vào `AppModule`                                                  | Khi chỉ cần thêm 1 module trống (vd. module hạ tầng), không cần 5 method CRUD mẫu                                                                         |
| `nest g controller RESOURCE_NAME --no-spec`                     | Chỉ sinh 1 file controller, bỏ qua file `*.spec.ts` mẫu                                                                 | Khi thêm controller cho API nghiệp vụ (§C) — không cần scaffold cả resource CRUD                                                                          |
| `nest g service RESOURCE_NAME --no-spec`                        | Chỉ sinh 1 file service, bỏ qua file `*.spec.ts` mẫu                                                                    | Tương tự trên, khi chỉ cần thêm 1 service (vd. tách use-case riêng cho API nghiệp vụ)                                                                     |
| `nest g class RESOURCE_NAME/dto/create-RESOURCE_NAME --no-spec` | Sinh 1 class DTO rỗng tại đúng path quy ước                                                                             | Khi cần thêm 1 DTO lẻ (vd. request DTO cho API nghiệp vụ không nằm trong resource CRUD)                                                                   |
| `nest build`                                                    | Build production ra `../../dist` (chính là lệnh `npm run build` gọi bên trong)                                          | Trước khi deploy, hoặc muốn build tay không qua npm script                                                                                                |
| `nest start --watch`                                            | Chạy app ở chế độ dev, tự reload khi sửa code (chính là lệnh `npm run start:dev` gọi bên trong)                         | Trong lúc code, để thấy thay đổi ngay lập tức                                                                                                             |

### b. Prisma CLI

> ⚠️ Project dùng file config **`../../prisma7.config.ts`** — mọi lệnh `prisma` đều cần thêm `--config prisma7.config.ts`, nếu không CLI sẽ không tìm thấy schema/`DATABASE_URL`.

| Lệnh                                                                      | Tác dụng                                                                                        | Khi nào dùng                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx prisma format --config prisma7.config.ts`                            | Tự format lại các file `.prisma` trong `../../prisma/schema` cho đúng convention indent/spacing | Sau khi sửa tay `schema.prisma`/`enums.prisma`, trước khi commit                                                                                                                                                                                   |
| `npx prisma validate --config prisma7.config.ts`                          | Kiểm tra schema hợp lệ (cú pháp, quan hệ, kiểu dữ liệu...), **không đụng vào DB thật**          | Muốn kiểm tra nhanh schema đúng chưa mà chưa cần migrate (vd. trong CI, hoặc trước khi mở PR)                                                                                                                                                      |
| `npx prisma migrate dev --name MIGRATION_NAME --config prisma7.config.ts` | Tạo migration mới + áp dụng lên DB dev + tạo bảng lần đầu / mỗi khi đổi schema                  | [§B2 Migration](#b2-migration--generate-prisma-client) — sau khi thêm/sửa model ở [§B1](#b1-database-impact--model-mới-hoặc-đã-có-trong-prismaschemaschemaprisma). ⚠️ Chỉ dùng ở **dev**; Prisma v7 **không** tự chạy `generate`/seed sau lệnh này |
| `npx prisma generate --config prisma7.config.ts`                          | Sinh lại Prisma Client (type TypeScript khớp schema mới) vào `../../src/generated/prisma`       | **Luôn chạy ngay sau `migrate dev`** ở Prisma v7 — nếu quên, code TypeScript vẫn dùng type Prisma Client cũ, không thấy field mới                                                                                                                  |
| `npx prisma migrate deploy --config prisma7.config.ts`                    | Áp dụng các migration đã có (không tạo migration mới, không hỏi tương tác)                      | Khi deploy lên **production/staging** (CI/CD) — không dùng `migrate dev` ở môi trường này                                                                                                                                                          |
| `npx prisma migrate reset --config prisma7.config.ts`                     | Xoá sạch dữ liệu + bảng, chạy lại toàn bộ migration từ đầu + seed                               | ⚠️ Chỉ dùng ở **dev**, khi DB local bị lệch/hỏng và muốn làm lại từ đầu — **mất hết data hiện có**                                                                                                                                                 |
| `npx prisma db seed --config prisma7.config.ts`                           | Chạy `../../prisma/seed.ts` để tạo dữ liệu mẫu (vd. tài khoản ADMIN bootstrap cho auth)         | Sau khi migrate xong trên DB mới/rỗng, hoặc khi cần seed lại tài khoản test (tương đương `npm run db:seed`)                                                                                                                                        |
| `npx prisma studio --config prisma7.config.ts`                            | Mở GUI trên trình duyệt để xem/sửa data trực tiếp trong DB                                      | Khi cần kiểm tra nhanh data thật đang có gì mà không muốn viết query tay                                                                                                                                                                           |

### c. npm scripts

| Lệnh                   | Tác dụng                                                                                         | Khi nào dùng                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run start:dev`    | Chạy app dev, tự reload khi sửa code                                                             | Trong lúc code hằng ngày                                                                                                  |
| `npm run start:debug`  | Chạy dev kèm debugger (`--inspect`)                                                              | Khi cần đặt breakpoint, debug logic phức tạp thay vì chỉ đọc log                                                          |
| `npm run build`        | Build TypeScript ra `../../dist`, có kiểm tra type qua quá trình build                           | Trước khi `start:prod`, hoặc để chắc chắn code build sạch trước khi mở PR ([§19](#a-flow-tổng-quát--áp-dụng-cho-mọi-api)) |
| `npm run start:prod`   | Chạy bản đã build (`node dist/main`), giống môi trường production                                | Kiểm tra thử bản build thật chạy đúng trước khi deploy                                                                    |
| `npm run typecheck`    | Chạy `tsc --noEmit` — chỉ kiểm tra type, không sinh file build                                   | Muốn kiểm tra lỗi type nhanh, không cần đợi build ra `../../dist`                                                         |
| `npm run lint`         | Lint code bằng `oxlint` (`../../src`, `test/`)                                                   | Trước khi commit/mở PR — theo Definition of Done                                                                          |
| `npm run format`       | Tự format code bằng `prettier`                                                                   | Trước khi commit, hoặc sau khi code xong 1 file để chuẩn hoá style                                                        |
| `npm run test`         | Chạy toàn bộ unit test (`vitest run`)                                                            | [§B8 Testing](#b8-testing) — sau khi viết/sửa service, trước khi commit                                                   |
| `npm run test:watch`   | Chạy unit test ở chế độ watch, tự chạy lại khi sửa file                                          | Trong lúc viết test, muốn thấy kết quả ngay khi lưu file                                                                  |
| `npm run test:debug`   | Chạy test kèm debugger, tắt chạy song song để dễ debug từng test                                 | Khi 1 test fail khó hiểu, cần đặt breakpoint để trace                                                                     |
| `npm run test:cov`     | Chạy unit test kèm báo cáo coverage                                                              | Muốn biết phần code nào chưa có test bao phủ                                                                              |
| `npm run test:e2e`     | Chạy e2e test (`../../vitest.config.e2e.ts`, gọi thật qua HTTP)                                  | [§B8b](#b-api-e2e-test--gọi-thật-qua-http-supertest) — sau khi viết xong controller + route thật                          |
| `npm run db:seed`      | Chạy `../../prisma/seed.ts` (tương đương `prisma db seed`, nhưng qua `tsx` không cần `--config`) | Sau khi migrate DB mới/rỗng, hoặc cần tài khoản ADMIN bootstrap để login trong e2e test                                   |
| `npm run postman:sync` | Đồng bộ Postman collection từ Swagger spec (`/api-json`) — app phải đang chạy                    | [§B12 Swagger](#b12-swagger--openapi) — sau khi thêm/sửa decorator Swagger cho endpoint mới                               |

> `npm run db:seed` cần cả MinIO đang chạy (`docker compose up -d minio minio-init`) — seed upload ảnh mẫu cho product lên bucket thay vì lưu URL placeholder bên ngoài.

### d. Git & PR workflow

> Chi tiết đầy đủ về branching xem [`git-workflow.md`](git-workflow.md). Tóm tắt: `main` (trunk ổn định) ← `dev` (integration) ← `feature/*`/`fix/*`/`chore/*`/`docs/*` (checked out từ `dev`, merge lại qua PR). Không commit thẳng vào `main`; hạn chế commit trực tiếp lớn vào `dev`.

| Lệnh                                       | Tác dụng                                                      | Khi nào dùng                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `git checkout dev && git pull`             | Chuyển sang `dev` và lấy code mới nhất                        | Trước khi bắt đầu 1 API/resource mới — luôn xuất phát từ `dev` mới nhất, không phải `main`/`master`  |
| `git checkout -b feature/RESOURCE_NAME`    | Tạo + chuyển sang branch mới, checkout từ `dev`               | [§20 PR](#a-flow-tổng-quát--áp-dụng-cho-mọi-api) — ngay khi bắt đầu code 1 resource/API mới          |
| `git add FILE_PATH`                        | Đưa file vào staging area để chuẩn bị commit                  | Sau khi code xong 1 phần việc rõ ràng (vd. xong DTO + Service của resource)                          |
| `git commit -m "COMMIT_MESSAGE"`           | Tạo 1 commit từ các file đã stage                             | Sau `git add`; message mô tả **vì sao** thay đổi, không chỉ liệt kê file đã sửa                      |
| `git push -u origin feature/RESOURCE_NAME` | Đẩy branch mới lên remote lần đầu, gắn tracking branch        | Sau commit đầu tiên trên branch mới, để mở PR hoặc để người khác review được                         |
| `gh pr create`                             | Mở Pull Request từ branch hiện tại vào `dev` (qua GitHub CLI) | Khi code + test đã xong, đã qua [Definition of Done](#definition-of-done) — dùng qua `ship-pr` skill |

> ⚠️ Không thêm `Co-Authored-By: Claude` hay bất kỳ attribution AI nào vào commit message trong repo này.
