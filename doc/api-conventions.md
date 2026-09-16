# Convention: phát triển API trong NestJS (ecommerce project)

Tài liệu này có 3 phần:

- **[A. Flow tổng quát](#a-flow-tổng-quát--áp-dụng-cho-mọi-api)** — áp dụng cho **bất kỳ API nào**: CRUD resource (`categories`, `products`...) lẫn API nghiệp vụ không-CRUD (`checkout`, `cancelOrder`, `login`, `applyCoupon`, `refundPayment`...).
- **[B. CRUD Resource Flow](#b-crud-resource-flow-trường-hợp-cụ-thể)** — bản chi tiết hoá của flow A cho trường hợp cụ thể **CRUD resource thuần** (`create/findAll/findOne/update/remove`), dùng model `Category` làm ví dụ chạy xuyên suốt.
- **[C. Business/Use-case API Flow](#c-businessuse-case-api-flow-non-crud)** — cùng flow A nhưng áp dụng cho API nghiệp vụ, nơi tên method không phải `create/findAll/...` mà là `checkout()`, `cancelOrder()`, `applyCoupon()`...

CRUD chỉ là **một trường hợp riêng** của flow API tổng quát — đừng dùng mục B làm khuôn cho mọi endpoint; API nghiệp vụ phức tạp nên bắt đầu từ mục A rồi tham khảo mục C.

> `doc/CRUD-NESTJS.md` là bản gốc (ví dụ `Todo`, module đã bị xoá khỏi `src/` khi domain pivot sang ecommerce) — giữ lại làm tư liệu lịch sử. File này là bản hiện hành.
>
> ⚠️ `CONTEXT.md` ở root hiện vẫn mô tả domain "Todo List" cũ, chưa khớp schema ecommerce thật (`docs/agents/domain.md` yêu cầu đọc `CONTEXT.md` trước khi code) — gap đã biết, cần task riêng để cập nhật, không xử lý trong convention này.

## A. Flow tổng quát — áp dụng cho MỌI API

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
12. Transaction (nếu cần)           — khi cả một business operation cần atomic (không phải cứ ≥2 write là tự động cần transaction — xem §5c)
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

Cả hai chủ đề này khá sâu (outbox pattern, saga, optimistic locking...) — tài liệu này chỉ đặt câu hỏi checkpoint, chưa đi sâu kỹ thuật vì project hiện chưa có API nào thực sự cần tới; khi có (`checkout`, `payment`...) nên tách thành ADR/doc riêng.

**§16 Logging / Audit / Metrics** — không phải API nào cũng cần, nhưng nên tự hỏi trước khi coi là xong: có cần log business event không (vd. `order cancelled`, `login failed`)? Có cần audit trail (ai làm gì, lúc nào) không — đặc biệt với hành động có thể tranh chấp (huỷ đơn, hoàn tiền, đổi quyền)? Có metric quan trọng cần theo dõi không (tỷ lệ lỗi checkout, thời gian xử lý payment...)? CRUD nội bộ như `Category` thường không cần gì thêm ngoài log mặc định của framework; API nghiệp vụ nhạy cảm (`checkout`, `payment`, `refund`, `cancelOrder`, `login`) nên có ít nhất audit log. Project hiện chưa có cơ chế logging/audit chuẩn hoá nào — khi cần, nên thiết kế chung (interceptor/middleware) thay vì mỗi module tự viết log rời rạc.

---

## B. CRUD Resource Flow (trường hợp cụ thể)

Bên dưới là flow A áp dụng đầy đủ cho 1 CRUD resource — dùng `Category` (`prisma/schema/schema.prisma`) làm ví dụ, vì đây là resource đơn giản nhất trong schema ecommerce (không quan hệ phức tạp, không cần auth).

### 0. Requirement / Business Rules / API Contract (rút gọn cho CRUD)

Với CRUD thuần, 3 bước đầu của flow A thường chỉ là:

- Requirement: quản lý danh mục sản phẩm (tạo/sửa/xoá/liệt kê).
- Business rule: `slug` phải duy nhất; không có rule nghiệp vụ phức tạp nào khác.
- API contract: `POST/GET/GET/PATCH/DELETE /categories` — chuẩn REST, request/response gần như map 1-1 với model DB.

→ Vì contract gần như trùng schema, có thể đi thẳng vào bước migration bên dưới. Với API nghiệp vụ (§C), 3 bước này **không được rút gọn** vì contract khác hẳn shape DB.

### 1. Database impact — model đã có trong `prisma/schema/schema.prisma`

```prisma
model Category {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @db.VarChar(150)
  slug        String   @unique @db.VarChar(150)
  description String?
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  products Product[]

  @@map("categories")
}
```

Nếu model chưa tồn tại, thêm vào `prisma/schema/schema.prisma` trước. Nếu cần thêm enum mới, khai báo trong `prisma/schema/enums.prisma` (xem [convention tách schema thành nhiều file](#14-convention--schema-prisma-tách-thành-nhiều-file)) — Prisma tự merge mọi file `.prisma` trong thư mục `prisma/schema/` khi generate/migrate, không cần import.

### 2. Migration + generate Prisma Client

```bash
npx prisma migrate dev --name <ten-migration> --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
```

> ⚠️ **Prisma v7**: `migrate dev` **không còn tự động chạy `prisma generate` hoặc seed script** (khác với Prisma v5/v6). Phải gọi `prisma generate` riêng sau khi migrate nếu cần Prisma Client mới ngay (vd. để code TypeScript nhận đúng type field mới thêm). Xem thêm [13. Phụ lục CLI](#13-phụ-lục--tổng-hợp-lệnh-cli-cần-dùng).
>
> Project cũng dùng file config tên **`prisma7.config.ts`** (không phải mặc định `prisma.config.ts`) — mọi lệnh `prisma` đều cần `--config prisma7.config.ts`.

(Tuỳ chọn) Seed dữ liệu mẫu: `npx prisma db seed --config prisma7.config.ts`.

> Chỉ sau khi bảng tồn tại trong DB, `PrismaService` mới `create/findMany/update/delete` được — nếu chưa migrate, mọi lời gọi CRUD sẽ lỗi kiểu `relation "xxx" does not exist`.

### 3. Scaffold — cấu trúc thư mục chuẩn

Project là ESM (`"type": "module"`) — **mọi import nội bộ phải có đuôi `.js`**, kể cả import từ file `.ts`.

```
src/
  categories/
    dto/
      create-category.dto.ts
      update-category.dto.ts
    categories.controller.ts
    categories.service.ts
    categories.module.ts
```

> ⚠️ **Không dùng `entities/`**: `nest g resource` mặc định sinh thêm thư mục này (class đại diện response, dùng cho Swagger + `ClassSerializerInterceptor`). Convention project là **trả thẳng type Prisma sinh ra** cho resource không có field nhạy cảm (vd. `Category`) — xem [14. Response DTO / Serialization](#14-response-dto--serialization) khi nào bắt buộc phải có entity/DTO riêng.

Luôn bắt đầu bằng CLI:

```bash
nest g resource categories
```

Chọn transport **REST API**. CLI tự tạo đủ 4 file, tự wiring `@Module`, tự đăng ký vào `AppModule`, sinh sẵn 5 method rỗng `create/findAll/findOne/update/remove`.

Sau khi CLI sinh xong, **chỉnh tay**:

1. Xoá thư mục `entities/` sinh sẵn và file `*.spec.ts` rỗng (viết lại đúng cách ở [§8 Testing](#8-testing))
2. Bổ sung `class-validator` + `@ApiProperty` vào DTO (CLI sinh DTO rỗng)
3. Bổ sung decorator Swagger vào controller ([§6 Swagger](#6-swagger--openapi))
4. Sửa import cho đúng chuẩn ESM `.js`

### 4. Request DTO + Validation

```ts
// create-category.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ maxLength: 150 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ maxLength: 150 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

// update-category.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto.js';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
```

> ⚠️ Import `PartialType` từ **`@nestjs/swagger`**, không phải `@nestjs/mapped-types`. Cả hai đều làm mọi field optional, nhưng bản của `@nestjs/swagger` mới giữ đúng metadata OpenAPI (`@ApiProperty`) khi generate document — dùng `@nestjs/mapped-types` cho DTO có Swagger decorator sẽ làm lệch contract OpenAPI sinh ra.

### 5. Service / Use Case (business rule + Prisma call)

```ts
// categories.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Category } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({ data: createCategoryDto });
  }

  findAll(): Promise<Category[]> {
    return this.prisma.category.findMany();
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    await this.findOne(id); // xem lưu ý bên dưới về pre-fetch
    return this.prisma.category.update({ where: { id }, data: updateCategoryDto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.category.delete({ where: { id } });
  }
}
```

> **Về `findOne` trước `update`/`remove`**: đoạn trên chạy `SELECT` rồi mới `UPDATE`/`DELETE` — có race condition nhỏ (record bị request khác xoá giữa 2 câu lệnh, dẫn tới Prisma `P2025` khi update). Quy tắc: **không pre-fetch chỉ để xác nhận tồn tại** nếu exception filter đã map `P2025` → 404 (khi đó `update`/`delete` trực tiếp là đủ, để Prisma tự báo not-found). **Pre-fetch khi cần chính record đó để kiểm tra business rule** (ownership, status, quan hệ...) — trường hợp đó dù sao cũng phải đọc record trước khi ghi.

> **Business-specific error message**: exception filter ở [§7](#7-exception-mapping) chỉ nên là _safety net_ cho lỗi Prisma không lường trước, không phải nơi định nghĩa toàn bộ domain error. Khi biết trước 1 case cụ thể (vd. trùng `slug`), nên bắt ở service và ném message có ý nghĩa nghiệp vụ:
>
> ```ts
> async create(dto: CreateCategoryDto) {
>   const existing = await this.prisma.category.findUnique({ where: { slug: dto.slug } });
>   if (existing) {
>     throw new ConflictException(`Slug "${dto.slug}" đã tồn tại`);
>   }
>   return this.prisma.category.create({ data: dto });
> }
> ```
>
> So với để rơi xuống Prisma filter (trả `Giá trị đã tồn tại cho field: slug` chung chung), message ở service tầng nghiệp vụ rõ ràng hơn cho client.
>
> ⚠️ **Pre-check này không thay thế unique constraint ở DB.** Đoạn code trên vẫn có race condition: 2 request cùng gọi `create` gần như đồng thời có thể cùng `findUnique` ra "chưa tồn tại" rồi cùng `create` — request thứ 2 sẽ rớt xuống Prisma `P2002` chứ không rớt vào nhánh `ConflictException` phía trên. Coi pre-check là **UX layer** (trả message đẹp cho trường hợp thông thường), còn **unique constraint + [Exception filter §7](#7-exception-mapping) mới là lớp bảo vệ cuối cùng** (bắt buộc phải giữ, không được bỏ vì "đã có pre-check rồi").

### 5b. Data access layer — khi nào cần Repository?

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

CRUD như `Category` **không cần** tạo `CategoriesRepository` riêng — bọc `prisma.category.findUnique(...)` vào 1 class khác chỉ tạo abstraction không giá trị. Chỉ cân nhắc tách Repository khi có: query phức tạp tái sử dụng nhiều nơi, nhiều aggregate cùng tham gia 1 nghiệp vụ, transaction lớn, hoặc cần cô lập ORM khỏi business logic (test/thay ORM). Không áp đặt Repository cho mọi resource.

### 5c. Transaction — khi nào atomic

Không áp dụng cho `Category` (chỉ 1 write). Quy tắc **không phải "cứ ≥2 write là cần transaction"** — mà là: khi cả một **business operation** phải cùng thành công/thất bại như 1 đơn vị (không được để nửa chừng), vd. tạo `Order` + `OrderItem` + trừ `Inventory`. Ngược lại, có trường hợp 3 write độc lập không cần chung transaction, và có trường hợp chỉ 1 write nhưng đi kèm `read → check` phía trước lại cần transaction/lock để chống race condition (xem §05 Concurrency ở mục A). Dùng `prisma.$transaction`:

```ts
return this.prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: orderData });
  await tx.orderItem.createMany({ data: items });
  await tx.inventory.updateMany({/* ... */});
  return order;
});
```

Xem ví dụ đầy đủ hơn ở [§C — Checkout](#c-businessuse-case-api-flow-non-crud).

### 6. Controller

```ts
// categories.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Tạo thành công' })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOkResponse({ description: 'Danh sách category' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Chi tiết 1 category' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Cập nhật thành công' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Xoá thành công' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
```

| HTTP             | Method                    | Ý nghĩa                                            |
| ---------------- | ------------------------- | -------------------------------------------------- |
| POST             | `create()`                | Tạo mới                                            |
| GET              | `findAll()` / `findOne()` | Đọc danh sách / đọc 1                              |
| PATCH (hoặc PUT) | `update()`                | PATCH = cập nhật một phần, PUT = thay thế toàn bộ  |
| DELETE           | `remove()`                | Xóa (trả `204 No Content`, không có response body) |

> Model dùng `id String @default(uuid())` → dùng `ParseUUIDPipe`. Với resource khác dùng `id Int @default(autoincrement())` thì đổi sang `ParseIntPipe` — luôn kiểm tra kiểu `id` thật trong schema trước khi copy.

### 7. Exception Mapping

Prisma ném `PrismaClientKnownRequestError` (`P2002` = unique constraint, `P2025` = record không tồn tại...). Không bắt thì NestJS trả `500` cho mọi lỗi DB. Filter này là **safety net cho lỗi không lường trước**, không thay thế domain error đã biết trước (xem lưu ý ở [§5](#5-service--use-case-business-rule--prisma-call)):

```ts
// prisma/prisma-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.target as string[])?.join(', ');
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: `Giá trị đã tồn tại cho field: ${target}`,
        });
      }
      case 'P2025':
        return response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record không tồn tại',
        });
      default:
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        });
    }
  }
}
```

Đăng ký global trong `main.ts`: `app.useGlobalFilters(new PrismaExceptionFilter());`

> ⚠️ **Gap đã biết (non-blocking cho `Category`)**: filter này **chưa tồn tại** trong `src/`. `Category.slug` có `@unique` nên sẽ trả `500` thay vì `409` cho tới khi có filter — nên làm sớm, nhưng không block việc tạo resource mới.

### 8. Testing

Project dùng **Vitest** (`vitest.config.ts` unit, `vitest.config.e2e.ts` e2e) + `supertest`.

**Chiến lược ưu tiên** (đảo lại so với "mọi resource phải có unit test controller"):

| Loại test            | Bắt buộc khi nào                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service unit test    | **Bắt buộc nếu service có business logic** (validate, tính toán, điều kiện)                                                                                                                                                           |
| API e2e test         | **Bắt buộc cho public endpoint / endpoint quan trọng** (checkout, auth, payment...) — và khuyến nghị cho mọi CRUD                                                                                                                     |
| Controller unit test | **Optional** — controller mỏng (chỉ `return this.service.x()`) thì test này chỉ xác nhận "controller có gọi service", không xác nhận route/pipe/validation/status code/filter có chạy đúng không. e2e đã cover việc đó tốt hơn nhiều. |

Lý do đảo: 1 controller mỏng như `findAll() { return this.categoriesService.findAll(); }` — unit test kiểu `expect(serviceMock.findAll).toHaveBeenCalled()` có giá trị thấp, không phát hiện được lỗi route, `ValidationPipe`, `ParseUUIDPipe`, exception filter, hay serialization sai. e2e test chạy qua toàn bộ pipeline thật (`HTTP → Pipe → Controller → Service → Prisma → Response`) nên đáng tin hơn cho đúng những thứ controller test không cover được.

#### a. Unit test cho Service — mock `PrismaService`

```ts
// categories.service.spec.ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoriesService } from './categories.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('CategoriesService', () => {
  let service: CategoriesService;
  const prismaMock = {
    category: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(CategoriesService);
    vi.clearAllMocks();
  });

  it('findOne ném NotFoundException khi không tìm thấy', async () => {
    prismaMock.category.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('create gọi prisma.category.create với đúng data', async () => {
    const dto = { name: 'Giày', slug: 'giay' };
    prismaMock.category.create.mockResolvedValue({ id: '1', ...dto });
    const result = await service.create(dto as any);
    expect(prismaMock.category.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual({ id: '1', ...dto });
  });
});
```

#### b. API e2e test — gọi thật qua HTTP (`supertest`)

```ts
// test/categories.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';

describe('Categories (e2e)', () => {
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

  it('POST /categories tạo mới và trả 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Giày', slug: `giay-${Date.now()}` })
      .expect(201);

    expect(res.body).toMatchObject({ name: 'Giày' });
  });

  it('POST /categories với body thiếu field bắt buộc trả 400', async () => {
    await request(app.getHttpServer()).post('/categories').send({}).expect(400);
  });

  it('POST /categories trùng slug trả 409', async () => {
    const slug = `giay-dup-${Date.now()}`;
    await request(app.getHttpServer()).post('/categories').send({ name: 'A', slug }).expect(201);
    await request(app.getHttpServer()).post('/categories').send({ name: 'B', slug }).expect(409);
  });

  it('GET /categories/:id trả 404 khi không tồn tại', async () => {
    await request(app.getHttpServer()).get('/categories/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('GET /categories/:id với id không phải UUID trả 400', async () => {
    await request(app.getHttpServer()).get('/categories/not-a-uuid').expect(400);
  });
});
```

> **Không duplicate bootstrap config giữa `main.ts` và e2e setup.** Nếu `main.ts` khai báo `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` nhưng e2e chỉ set `{ whitelist: true, transform: true }`, test có thể pass trong khi app thật xử lý khác (vd. field lạ: e2e không set `forbidNonWhitelisted` nên không phát hiện được nếu app thật lẽ ra phải trả 400). Tách phần config chung ra 1 hàm dùng lại ở cả 2 chỗ:
>
> ```ts
> // src/bootstrap/configure-app.ts
> import { INestApplication, ValidationPipe } from '@nestjs/common';
>
> export function configureApp(app: INestApplication) {
>   app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
>   // app.useGlobalFilters(new PrismaExceptionFilter()); // khi filter §7 đã implement
> }
> ```
>
> ```ts
> // main.ts
> configureApp(app);
> ```
>
> ⚠️ **Gap đã biết**: `src/bootstrap/configure-app.ts` **chưa tồn tại** — `main.ts` và ví dụ e2e ở trên hiện đang khai báo `ValidationPipe` riêng lẻ, không dùng chung. Nên tạo file này khi viết e2e test đầu tiên.

Chạy: `npm run test` (unit) · `npm run test:e2e` (e2e) · `npm run test:cov` (coverage).

### 9. Best practice khác

- **ValidationPipe global** đã bật trong `main.ts`: `whitelist`, `forbidNonWhitelisted`, `transform`.
- Service không phụ thuộc `Request`/`Response` của Express — giữ logic thuần, dễ test.
- Đặt tên method service theo convention `create/findAll/findOne/update/remove` cho CRUD; API nghiệp vụ dùng tên mô tả hành vi (xem [§C](#c-businessuse-case-api-flow-non-crud)).
- **Đọc biến môi trường qua `ConfigService`**, không đọc thẳng `process.env`.

  > ⚠️ **Gap đã biết (non-blocking)**: `ConfigModule.forRoot({ isGlobal: true })` đã đăng ký trong `app.module.ts`, nhưng `PrismaService` vẫn đọc thẳng `process.env.DATABASE_URL`.

### 10. Authorization checkpoint

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

Ví dụ dự kiến cho `categories`:

```
GET    /categories        → public
GET    /categories/:id    → public
POST   /categories        → admin
PATCH  /categories/:id    → admin
DELETE /categories/:id    → admin
```

> ⚠️ **Gap đã biết — BLOCKING cho resource cần bảo vệ**: project hiện **chưa có auth/guard nào** (không JWT strategy, không `@CurrentUser`, dù schema đã có `User`/`Role`/`RefreshToken`). Với `Category` (CRUD public-read, admin-write không critical) đây là non-blocking tạm thời chấp nhận được để phát triển song song. Với resource nhạy cảm hơn (`Order`, `Cart`, `Payment`, hay bất kỳ API nghiệp vụ nào ở [§C](#c-businessuse-case-api-flow-non-crud)) đây là **gap chặn (blocking)** — không nên ship các API đó tới người dùng thật khi chưa có auth, dù code CRUD có thể viết trước để chuẩn bị.

### 11. Response DTO / Serialization

Nguyên tắc chung: **Database Model ≠ API Response Contract.**

`Category` không có field nhạy cảm nên trả thẳng Prisma type là chấp nhận được cho resource nhỏ, ít thay đổi. Nhưng khi model có field không được lộ ra ngoài (vd. `User.passwordHash`, các `tokenHash` trong `RefreshToken`/`PasswordResetToken`), có 2 cách:

**a. Blacklist (`ClassSerializerInterceptor` + `@Exclude()`)** — nhanh, ít code, nhưng rủi ro: field mới thêm vào model sau này mặc định **được lộ ra** trừ khi nhớ thêm `@Exclude()`.

```ts
import { Exclude } from 'class-transformer';

export class UserEntity {
  id: string;
  email: string;

  @Exclude()
  passwordHash: string;
}
```

**b. Allow-list (Response DTO riêng, map thủ công từ Prisma result)** — verbose hơn, nhưng an toàn hơn: field mới thêm vào model **không tự động lộ ra** cho tới khi chủ động thêm vào DTO.

```ts
export class CategoryResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}
```

→ **Khuyến nghị**: dùng allow-list (Response DTO) cho model có field nhạy cảm hoặc thường xuyên thêm field mới (`User`, `Order`...); blacklist (`@Exclude`) chấp nhận được cho resource nhỏ, ổn định như `Category`. Khi dùng Response DTO, khai `type:` tương ứng trong Swagger (mục dưới) để OpenAPI phản ánh đúng contract, không phải shape DB.

### 12. Swagger / OpenAPI

Swagger đã bật sẵn trong `main.ts`, xem tại `http://localhost:3000/api`. Ngoài mô tả bằng `description` (đủ cho người đọc), nên khai **response type** để OpenAPI document biết chính xác shape trả về — phục vụ generate client/type cho frontend, contract testing:

```ts
@Post()
@ApiCreatedResponse({ type: CategoryResponseDto })
create(@Body() dto: CreateCategoryDto) { ... }

@Get(':id')
@ApiOkResponse({ type: CategoryResponseDto })
findOne(@Param('id', ParseUUIDPipe) id: string) { ... }
```

Không bắt buộc phải có `CategoryResponseDto` riêng nếu resource trả thẳng Prisma type (§11.a) — khi đó `type:` có thể trỏ vào 1 class khai lại field cho Swagger đọc (Prisma type không tự mang metadata OpenAPI).

**Đồng bộ sang Postman:** không tạo/sửa request thủ công trong Postman collection. Swagger (`/api-json`) là nguồn chuẩn duy nhất — sau khi thêm/sửa API (đủ decorator Swagger ở trên), chạy:

```bash
npm run start:dev                # app phải đang chạy để có /api-json
npm run postman:sync             # fetch OpenAPI spec → convert → PUT lên Postman collection
```

Cần set `POSTMAN_API_KEY` và `POSTMAN_COLLECTION_ID` trong `.env` (xem `.env.example`). Script ở `scripts/sync-postman-collection.ts`, ghi đè toàn bộ nội dung collection trên Postman bằng spec hiện tại — không dùng cho collection có chứa request/example thủ công cần giữ lại.

### 13. Pagination cho `findAll()`

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
// categories.service.ts
async findAll({ page, limit }: PaginationDto) {
  const [data, total] = await Promise.all([
    this.prisma.category.findMany({
      skip: (page - 1) * limit,
      take: limit,
      // createdAt có thể trùng (cùng millisecond) → luôn kèm id làm tie-breaker
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    this.prisma.category.count(),
  ]);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
```

> **Pagination luôn phải đi cùng deterministic ordering.** Không set `orderBy` thì thứ tự trả về không đảm bảo ổn định giữa các lần gọi (đặc biệt khi có insert/delete xen giữa) — người dùng chuyển trang có thể thấy record trùng lặp hoặc bị bỏ sót. Nếu cho phép client chọn field sort, whitelist rõ field nào được phép thay vì nhận thẳng tên field từ query string.

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

Áp dụng khi resource dự kiến nhiều bản ghi (`Product`, `Order`...). Với `Category` (thường ít bản ghi) là optional.

### 14. Convention — schema Prisma tách thành nhiều file

Project dùng **multi-file schema** của Prisma (từ bản v6.7+, ổn định ở v7 project đang dùng), không còn 1 file `prisma/schema.prisma` duy nhất:

```
prisma/
  schema/
    schema.prisma   — generator, datasource, và toàn bộ model
    enums.prisma    — toàn bộ enum
  migrations/
  seed.ts
```

- `prisma7.config.ts` trỏ `schema: "prisma/schema"` (thư mục, không phải 1 file) — Prisma tự merge mọi file `.prisma` trong thư mục này khi `validate`/`generate`/`migrate`, không cần khai báo import giữa các file.
- **Model** → thêm vào `prisma/schema/schema.prisma`.
- **Enum** → thêm vào `prisma/schema/enums.prisma`.
- Lý do tách: enum là khai báo tĩnh (list giá trị), không có logic, tách riêng giúp mục lục file gọn và dễ tìm khi schema phình to nhiều model — không phải bug hay yêu cầu bắt buộc của Prisma, chỉ là convention tổ chức file của project này.
- `generator client { output = "../../src/generated/prisma" }` — path `output` tính từ vị trí file `schema.prisma` (tức `prisma/schema/schema.prisma`), nên có 2 cấp `../..` chứ không phải 1 cấp như khi còn 1 file `prisma/schema.prisma`.
- Mọi lệnh CLI (`prisma validate`, `generate`, `migrate dev`, `format`...) không đổi cú pháp — chỉ cần `--config prisma7.config.ts` như cũ (xem [Phụ lục](#phụ-lục--tổng-hợp-lệnh-cli-cần-dùng)).

---

## C. Business/Use-case API Flow (non-CRUD)

Áp dụng flow A cho API **không phải CRUD resource** — tên method mô tả hành vi nghiệp vụ, không phải `create/findAll/findOne/update/remove`. Ví dụ: `POST /auth/login`, `POST /orders/:id/cancel`, `POST /cart/checkout`, `POST /coupons/apply`, `POST /users/change-password`, `POST /payments/:id/refund`.

Khác biệt chính so với mục B:

- **§01–04 (Requirement/Business Rules/Contract/Authorization) không được rút gọn** — đây là phần quan trọng nhất, vì request/response shape thường không map trực tiếp vào 1 model DB.
- **Service method đặt tên theo hành vi** (`checkout()`, `cancelOrder()`, `applyCoupon()`), không theo `create/update`.
- **Thường cần transaction** (§5c) vì phải ghi nhiều bảng atomic.
- **Business rule là trọng tâm**, Prisma call chỉ là bước cuối để hiện thực hoá rule đó.

Ví dụ minh hoạ — `POST /orders/:id/cancel` (chưa implement trong `src/`, chỉ minh hoạ flow):

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

> Ví dụ trên minh hoạ flow, **chưa có module `orders`/`auth` nào tồn tại trong `src/` hiện tại** — khi thực sự implement, đối chiếu lại với schema thật (`Order`, `OrderItem`, `Inventory` trong `prisma/schema/schema.prisma`) và áp dụng đúng auth guard một khi guard đó đã được xây dựng (xem [§10](#10-authorization-checkpoint)).
>
> Khi project thực sự có API xử lý payment/refund thật (không còn là ví dụ minh hoạ), nên tách chủ đề **external side effects / outbox / saga / idempotency-key thực thi** thành 1 ADR riêng (`docs/adr/`) thay vì tiếp tục mở rộng convention này — tài liệu này nên dừng ở mức "biết để hỏi đúng câu hỏi", không phải nơi định nghĩa chi tiết kỹ thuật cho từng pattern.

---

## Definition of Done

Một API được coi là **xong**, không phải "code chạy được", khi tất cả các mục sau đều đúng:

- Requirement + Business Rules đã rõ ràng, không còn giả định ngầm
- Authorization đã được xác định (kể cả khi kết luận là "public, không cần auth")
- DTO validate đầy đủ input, không dựa vào giả định client gửi đúng
- Lỗi được map đúng HTTP status (không rơi vào `500` cho case đã biết trước)
- Response contract rõ ràng — không rò field nhạy cảm không cố ý
- Test pass: service unit test (nếu có business logic) + e2e (nếu là endpoint public/quan trọng)
- Swagger phản ánh đúng request/response thật (có `type:`, không chỉ `description`)
- `npm run lint` + `npm run format` + `npm run build` sạch
- PR đã mở, review xong (`ship-pr` skill)

Checklist chi tiết bên dưới là cách để đạt Definition of Done này, không phải mục tiêu độc lập.

## Checklist khi tạo API mới

### CRUD resource

- [ ] Model (hoặc enum) đã có trong `prisma/schema/schema.prisma` (hoặc `prisma/schema/enums.prisma`) + đã `migrate dev` + `generate` (2 lệnh riêng — Prisma v7 không tự generate)
- [ ] Sinh khung bằng `nest g resource <ten>` (chọn REST API)
- [ ] Xoá `entities/` sinh sẵn, xoá/viết lại `*.spec.ts` mẫu
- [ ] DTO có đủ `class-validator` + `@ApiProperty`/`@ApiPropertyOptional`; `UpdateDto` dùng `PartialType` từ **`@nestjs/swagger`**
- [ ] Param id dùng đúng pipe (`ParseUUIDPipe`/`ParseIntPipe` theo đúng kiểu trong schema)
- [ ] Business error đã biết trước (vd. trùng field unique) ném exception có message nghiệp vụ ở service, không phó mặc cho Prisma filter
- [ ] Service unit test — bắt buộc nếu service có business logic (not-found, conflict, tính toán...); service chỉ gọi thẳng Prisma không rẽ nhánh thì có thể bỏ qua
- [ ] API e2e test cho endpoint public/quan trọng — bắt buộc; cho CRUD thường — khuyến nghị
- [ ] Response DTO (allow-list) nếu model có field nhạy cảm; `@Exclude` chấp nhận được cho resource nhỏ ổn định
- [ ] Swagger có `type:` cho response (`@ApiOkResponse`/`@ApiCreatedResponse`), không chỉ `description`
- [ ] Pagination + `@Max(limit)` nếu resource dự kiến nhiều bản ghi
- [ ] Đã đi qua [Authorization checkpoint](#10-authorization-checkpoint)
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

| Gap                                                                            | Mức độ                                                                                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Chưa có `PrismaExceptionFilter` global (§7)                                    | Non-blocking cho CRUD nội bộ/admin; nên làm sớm                                                                            |
| `PrismaService` chưa dùng `ConfigService` (§9)                                 | Non-blocking                                                                                                               |
| Chưa có `src/bootstrap/configure-app.ts` dùng chung giữa `main.ts` và e2e (§8) | Non-blocking, nhưng nên làm trước khi viết nhiều e2e test để tránh test/app lệch config                                    |
| Chưa có auth/guard nào trong project (§10)                                     | **Blocking** cho mọi endpoint public-facing chứa dữ liệu nhạy cảm hoặc hành vi nghiệp vụ (order, cart, payment, user data) |
| `CONTEXT.md` mô tả domain "Todo" cũ, chưa khớp schema ecommerce                | Non-blocking cho việc code, nhưng gây nhầm domain nếu không đọc kỹ trước                                                   |

---

## Phụ lục — Tổng hợp lệnh CLI cần dùng

> ⚠️ Project dùng file config **`prisma7.config.ts`** — mọi lệnh `prisma` đều cần thêm `--config prisma7.config.ts`.

### a. Nest CLI

| Lệnh                                            | Dùng khi nào                                                   |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `nest g resource <ten>`                         | Sinh nhanh khung 1 resource CRUD đầy đủ — **cách khuyến nghị** |
| `nest g module <ten>`                           | Chỉ sinh riêng module                                          |
| `nest g controller <ten> --no-spec`             | Chỉ sinh riêng controller, bỏ file test mẫu                    |
| `nest g service <ten> --no-spec`                | Chỉ sinh riêng service, bỏ file test mẫu                       |
| `nest g class <ten>/dto/create-<ten> --no-spec` | Sinh 1 class DTO riêng lẻ                                      |
| `nest build`                                    | Build production (`npm run build` đã wrap)                     |
| `nest start --watch`                            | Chạy dev hot-reload (`npm run start:dev` đã wrap)              |

### b. Prisma CLI

| Lệnh                                                             | Dùng khi nào                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npx prisma format --config prisma7.config.ts`                   | Format lại `schema.prisma`                                                                                          |
| `npx prisma validate --config prisma7.config.ts`                 | Kiểm tra `schema.prisma` hợp lệ, không đụng DB                                                                      |
| `npx prisma migrate dev --name <ten> --config prisma7.config.ts` | Tạo bảng lần đầu / mỗi khi đổi schema — chỉ dùng ở **dev**. ⚠️ Prisma v7: **không** tự chạy `generate` hay seed nữa |
| `npx prisma generate --config prisma7.config.ts`                 | Sinh lại Prisma Client — **luôn chạy riêng sau `migrate dev`** ở Prisma v7                                          |
| `npx prisma migrate deploy --config prisma7.config.ts`           | Áp dụng migration đã có lên **production/staging**                                                                  |
| `npx prisma migrate reset --config prisma7.config.ts`            | ⚠️ Xoá sạch dữ liệu, chạy lại toàn bộ migration + seed — chỉ dùng ở **dev**                                         |
| `npx prisma db seed --config prisma7.config.ts`                  | Chạy `prisma/seed.ts`                                                                                               |
| `npx prisma studio --config prisma7.config.ts`                   | Mở GUI xem/sửa data                                                                                                 |

### c. npm scripts

| Lệnh                  | Dùng khi nào                      |
| --------------------- | --------------------------------- |
| `npm run start:dev`   | Chạy dev, tự reload               |
| `npm run start:debug` | Chạy dev kèm debugger             |
| `npm run build`       | Build ra `dist/`                  |
| `npm run start:prod`  | Chạy bản build production         |
| `npm run lint`        | Lint bằng `oxlint`                |
| `npm run format`      | Format bằng `prettier`            |
| `npm run test`        | Chạy toàn bộ unit test            |
| `npm run test:watch`  | Unit test ở chế độ watch          |
| `npm run test:cov`    | Unit test kèm coverage            |
| `npm run test:e2e`    | e2e test (`vitest.config.e2e.ts`) |
