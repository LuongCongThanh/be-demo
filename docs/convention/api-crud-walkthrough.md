# CRUD walkthrough: tạo 1 resource từ đầu tới PR

> 📖 Quy tắc (vì sao, khi nào bắt buộc) nằm ở [api-rules.md](api-rules.md) — file này chỉ là các bước + code mẫu. Thiết kế DB đích: [`../architecture/11-database.md`](../architecture/11-database.md); cách viết schema/Prisma Client: [prisma-conventions.md](prisma-conventions.md).

Dùng placeholder **`Resource`/`resource`** — thay bằng tên thật (class số ít viết hoa `Product`, route/thư mục số nhiều `products`). Business rule cụ thể của resource sống ở `../architecture/modules/<module>.md`.

## B0. Requirement / Contract (rút gọn cho CRUD)

- Requirement: quản lý 1 loại dữ liệu (tạo/sửa/xoá/liệt kê).
- Business rule: field nào server tự sinh, field nào unique, FK nào chặn xoá (cascade/restrict/set null) — mỗi resource khác nhau.
- Contract: `POST/GET/GET/PATCH/DELETE /resources`, gần như map 1-1 với model (trừ field server tự sinh). API nghiệp vụ không được rút gọn bước này ([api-rules.md §C](api-rules.md#c-businessuse-case-api-non-crud)).

## B1. Model trong `prisma/schema/schema.prisma`

Đối chiếu với [`11-database.md`](../architecture/11-database.md) trước, rồi khai báo (hoặc kiểm tra) model:

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

Schema tách nhiều file: model → `prisma/schema/schema.prisma`, enum → `prisma/schema/enums.prisma`; Prisma tự merge cả thư mục (`prisma7.config.ts` trỏ `schema: "prisma/schema"`), không cần import. Kiểu `id` (uuid hay autoincrement) quyết định pipe ở B6. Chi tiết: [prisma-conventions.md](prisma-conventions.md).

## B2. Migration + generate

```bash
npx prisma migrate dev --name MIGRATION_NAME --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
npx prisma db seed --config prisma7.config.ts   # tuỳ chọn
```

> ⚠️ Prisma v7: `migrate dev` **không** tự chạy `generate`/seed — phải gọi riêng. Mọi lệnh `prisma` cần `--config prisma7.config.ts`. Chưa migrate thì mọi query lỗi `relation "xxx" does not exist`.

## B3. Scaffold

```bash
nest g resource RESOURCE_NAME   # chọn REST API, Yes cho "generate CRUD entry points"
```

Cấu trúc đích (ESM — **mọi import nội bộ có đuôi `.js`**):

```
src/resources/
  dto/
    create-resource.dto.ts
    update-resource.dto.ts
    pagination.dto.ts
  resources.controller.ts
  resources.service.ts
  resources.module.ts
```

Chỉnh tay sau CLI: xoá `entities/` + `*.spec.ts` rỗng; thêm validator + `@ApiProperty` vào DTO; thêm decorator Swagger vào controller; sửa import `.js`; thêm `pagination.dto.ts`.

## B4. Request DTO

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

Quy tắc (`example:`, `PartialType` từ `@nestjs/swagger`, field server tự sinh): [api-rules.md §R1](api-rules.md#r1-request-dto--validation). Tham khảo `src/auth/dto/register.dto.ts`.

## B5. Service

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

> Mẫu trên pre-fetch bằng `findOne` cho dễ đọc. Theo [§R2](api-rules.md#r2-service--use-case), nếu không cần record để kiểm tra business rule thì bỏ pre-fetch, gọi thẳng `update`/`delete` và để `P2025` → 404. Domain error (trùng unique, còn record con) ném `ConflictException` có message ở đây — pre-check chỉ là UX layer, constraint DB vẫn là lớp cuối.

Transaction (khi cần, xem [§R4](api-rules.md#r4-transaction)):

```ts
return this.prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: orderData });
  await tx.orderItem.createMany({ data: items });
  await tx.inventory.updateMany({/* ... */});
  return order;
});
```

## B6. Controller

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

| HTTP             | Method                    | Ý nghĩa                                            |
| ---------------- | ------------------------- | -------------------------------------------------- |
| POST             | `create()`                | Tạo mới (201)                                      |
| GET              | `findAll()` / `findOne()` | Đọc danh sách / đọc 1                              |
| PATCH (hoặc PUT) | `update()`                | PATCH = cập nhật một phần, PUT = thay thế toàn bộ  |
| DELETE           | `remove()`                | Xoá (`204 No Content`, không body)                 |

- Đường dẫn guard giả định resource nằm ở `src/resources/` cạnh `src/auth/`.
- Resource public: bỏ `@UseGuards`/`@Roles`/`@ApiBearerAuth` ([§R5](api-rules.md#r5-authorization-checkpoint)); resource có chủ sở hữu dùng `OwnershipGuard` + `@OwnedResource()`.
- `id Int @default(autoincrement())` → đổi `ParseUUIDPipe` thành `ParseIntPipe`.
- Lỗi Prisma đã được `AllExceptionsFilter` xử lý global — không viết filter riêng ([§R6](api-rules.md#r6-exception-mapping)).

## B7. Response DTO (khi model có field nhạy cảm)

Allow-list (khuyến nghị — [§R7](api-rules.md#r7-response-dto--serialization)):

```ts
export class ResourceResponseDto {
  id: string;
  name: string;
  description: string | null;
}
```

Blacklist (chỉ resource nhỏ, ổn định):

```ts
import { Exclude } from 'class-transformer';

export class ResourceEntity {
  id: string;
  name: string;

  @Exclude()
  internalNote: string;
}

// main.ts
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

## B8. Swagger

Quy tắc: [§R8](api-rules.md#r8-swagger--openapi). Mẫu:

```ts
@ApiTags('Authentication & Authorization') // tag đủ nghĩa; path giữ nguyên
@Controller('auth')
export class AuthController { ... }

// src/main.ts — name khớp chính xác @ApiTags()
const config = new DocumentBuilder()
  .addTag(
    'Authentication & Authorization',
    'Register, email verification, login/refresh/logout, and role/ownership-based access control',
  )
  .addTag('Categories', 'Product category CRUD — writes gated to STORE_MANAGER/MASTER_ADMIN, reads public')
  .build();

@Post('verify-email')
@ApiOperation({ summary: 'Verify email address using the 6-digit code sent by email' })
verify(@Body() dto: VerifyEmailDto) { ... }

@Get(':id')
@ApiOkResponse({ type: ResourceResponseDto })
findOne(@Param('id', ParseUUIDPipe) id: string) { ... }
```

Tham khảo `src/auth/auth.controller.ts`. Sau khi xong: `npm run start:dev` → `npm run postman:sync`.

## B9. Pagination

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

Service xem `findAll` ở B5 (`orderBy` có tie-breaker, trả `{ data, meta }`); quy tắc: [§R9](api-rules.md#r9-pagination).

## B10. Testing

Chiến lược: [§R10](api-rules.md#r10-testing).

### a. Service unit test — mock `PrismaService`

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

Service có business rule riêng → thêm case cho nhánh đó (vd. `create` ném `ConflictException` khi trùng unique).

### b. API e2e — `supertest`

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

- `adminAccessToken`: login `POST /auth/login` bằng tài khoản ADMIN từ seed, 1 lần trong `beforeAll`.
- `configureApp()` (`src/bootstrap/configure-app.ts`) đã dùng chung cho `main.ts` và e2e — không khai lại `ValidationPipe` riêng. `AllExceptionsFilter` đăng ký qua `APP_FILTER` trong `app.module.ts` (cần DI để đọc `RequestContext`), không qua `configureApp()`.

---

## Phụ lục A — Lệnh CLI

### a. Nest CLI

| Lệnh                                                            | Tác dụng                                                                                                                | Khi nào dùng                                                                                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nest g resource RESOURCE_NAME`                                 | Sinh đủ 4 file (module/controller/service/DTO), tự wiring `@Module`, tự đăng ký vào `AppModule`, sinh sẵn 5 method rỗng | [B3](#b3-scaffold) — **luôn bắt đầu 1 resource CRUD mới bằng lệnh này**, chọn REST API + Yes cho CRUD entry points |
| `nest g module RESOURCE_NAME`                                   | Chỉ sinh 1 file `RESOURCE_NAME.module.ts` + tự đăng ký vào `AppModule`                                                  | Khi chỉ cần thêm 1 module trống (vd. module hạ tầng), không cần 5 method CRUD mẫu                                                                         |
| `nest g controller RESOURCE_NAME --no-spec`                     | Chỉ sinh 1 file controller, bỏ qua file `*.spec.ts` mẫu                                                                 | Khi thêm controller cho API nghiệp vụ — không cần scaffold cả resource CRUD                                                                          |
| `nest g service RESOURCE_NAME --no-spec`                        | Chỉ sinh 1 file service, bỏ qua file `*.spec.ts` mẫu                                                                    | Tương tự trên, khi chỉ cần thêm 1 service (vd. tách use-case riêng cho API nghiệp vụ)                                                                     |
| `nest g class RESOURCE_NAME/dto/create-RESOURCE_NAME --no-spec` | Sinh 1 class DTO rỗng tại đúng path quy ước                                                                             | Khi cần thêm 1 DTO lẻ (vd. request DTO cho API nghiệp vụ không nằm trong resource CRUD)                                                                   |
| `nest build`                                                    | Build production ra `dist` (chính là lệnh `npm run build` gọi bên trong)                                          | Trước khi deploy, hoặc muốn build tay không qua npm script                                                                                                |
| `nest start --watch`                                            | Chạy app ở chế độ dev, tự reload khi sửa code (chính là lệnh `npm run start:dev` gọi bên trong)                         | Trong lúc code, để thấy thay đổi ngay lập tức                                                                                                             |

### b. Prisma CLI (luôn kèm `--config prisma7.config.ts`)

| Lệnh                                                                      | Tác dụng                                                                                        | Khi nào dùng                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx prisma format --config prisma7.config.ts`                            | Tự format lại các file `.prisma` trong `prisma/schema` cho đúng convention indent/spacing | Sau khi sửa tay `schema.prisma`/`enums.prisma`, trước khi commit                                                                                                                                                                                   |
| `npx prisma validate --config prisma7.config.ts`                          | Kiểm tra schema hợp lệ (cú pháp, quan hệ, kiểu dữ liệu...), **không đụng vào DB thật**          | Muốn kiểm tra nhanh schema đúng chưa mà chưa cần migrate (vd. trong CI, hoặc trước khi mở PR)                                                                                                                                                      |
| `npx prisma migrate dev --name MIGRATION_NAME --config prisma7.config.ts` | Tạo migration mới + áp dụng lên DB dev + tạo bảng lần đầu / mỗi khi đổi schema                  | [B2](#b2-migration--generate) — sau khi sửa model ở [B1](#b1-model-trong-prismaschemaschemaprisma). ⚠️ Chỉ dùng ở **dev**; Prisma v7 **không** tự chạy `generate`/seed sau lệnh này |
| `npx prisma generate --config prisma7.config.ts`                          | Sinh lại Prisma Client (type TypeScript khớp schema mới) vào `src/generated/prisma`       | **Luôn chạy ngay sau `migrate dev`** ở Prisma v7 — nếu quên, code TypeScript vẫn dùng type Prisma Client cũ, không thấy field mới                                                                                                                  |
| `npx prisma migrate deploy --config prisma7.config.ts`                    | Áp dụng các migration đã có (không tạo migration mới, không hỏi tương tác)                      | Khi deploy lên **production/staging** (CI/CD) — không dùng `migrate dev` ở môi trường này                                                                                                                                                          |
| `npx prisma migrate reset --config prisma7.config.ts`                     | Xoá sạch dữ liệu + bảng, chạy lại toàn bộ migration từ đầu + seed                               | ⚠️ Chỉ dùng ở **dev**, khi DB local bị lệch/hỏng và muốn làm lại từ đầu — **mất hết data hiện có**                                                                                                                                                 |
| `npx prisma db seed --config prisma7.config.ts`                           | Chạy `prisma/seed.ts` để tạo dữ liệu mẫu (vd. tài khoản ADMIN bootstrap cho auth)         | Sau khi migrate xong trên DB mới/rỗng, hoặc khi cần seed lại tài khoản test (tương đương `npm run db:seed`)                                                                                                                                        |
| `npx prisma studio --config prisma7.config.ts`                            | Mở GUI trên trình duyệt để xem/sửa data trực tiếp trong DB                                      | Khi cần kiểm tra nhanh data thật đang có gì mà không muốn viết query tay                                                                                                                                                                           |

### c. npm scripts

| Lệnh                   | Tác dụng                                                                                         | Khi nào dùng                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run start:dev`    | Chạy app dev, tự reload khi sửa code                                                             | Trong lúc code hằng ngày                                                                                                  |
| `npm run start:debug`  | Chạy dev kèm debugger (`--inspect`)                                                              | Khi cần đặt breakpoint, debug logic phức tạp thay vì chỉ đọc log                                                          |
| `npm run build`        | Build TypeScript ra `dist`, có kiểm tra type qua quá trình build                           | Trước khi `start:prod`, hoặc để chắc chắn code build sạch trước khi mở PR  |
| `npm run start:prod`   | Chạy bản đã build (`node dist/main`), giống môi trường production                                | Kiểm tra thử bản build thật chạy đúng trước khi deploy                                                                    |
| `npm run typecheck`    | Chạy `tsc --noEmit` — chỉ kiểm tra type, không sinh file build                                   | Muốn kiểm tra lỗi type nhanh, không cần đợi build ra `dist`                                                         |
| `npm run lint`         | Lint code bằng `oxlint` (`src`, `test/`)                                                   | Trước khi commit/mở PR — theo Definition of Done                                                                          |
| `npm run format`       | Tự format code bằng `prettier`                                                                   | Trước khi commit, hoặc sau khi code xong 1 file để chuẩn hoá style                                                        |
| `npm run test`         | Chạy toàn bộ unit test (`vitest run`)                                                            | [B10](#b10-testing) — sau khi viết/sửa service, trước khi commit                                                   |
| `npm run test:watch`   | Chạy unit test ở chế độ watch, tự chạy lại khi sửa file                                          | Trong lúc viết test, muốn thấy kết quả ngay khi lưu file                                                                  |
| `npm run test:debug`   | Chạy test kèm debugger, tắt chạy song song để dễ debug từng test                                 | Khi 1 test fail khó hiểu, cần đặt breakpoint để trace                                                                     |
| `npm run test:cov`     | Chạy unit test kèm báo cáo coverage                                                              | Muốn biết phần code nào chưa có test bao phủ                                                                              |
| `npm run test:e2e`     | Chạy e2e test (`vitest.config.e2e.ts`, gọi thật qua HTTP)                                  | [B10b](#b-api-e2e--supertest) — sau khi viết xong controller + route thật                          |
| `npm run db:seed`      | Chạy `prisma/seed.ts` (tương đương `prisma db seed`, nhưng qua `tsx` không cần `--config`) | Sau khi migrate DB mới/rỗng, hoặc cần tài khoản ADMIN bootstrap để login trong e2e test                                   |
| `npm run postman:sync` | Đồng bộ Postman collection từ Swagger spec (`/api-json`) — app phải đang chạy                    | [B8](#b8-swagger) — sau khi thêm/sửa decorator Swagger cho endpoint mới                               |

Git/PR: xem [git-workflow.md](git-workflow.md) (branch từ `dev`, PR qua `/ship`, không AI attribution trong commit).

## Phụ lục B — Ví dụ non-CRUD: `cancelOrder`

Minh hoạ cho [api-rules.md §C](api-rules.md#c-businessuse-case-api-non-crud) — chưa implement; đối chiếu schema thật trước khi dùng.

```ts
// OrdersService.cancelOrder
return this.prisma.$transaction(async (tx) => {
  const order = await tx.order.findUniqueOrThrow({
    where: { id },
    include: { items: true },
  });
  // check ownership (order.userId === userId) — ném ForbiddenException nếu sai

  // TODO: refund gọi NGOÀI transaction; TODO: audit log

  // Conditional atomic update: điều kiện status nằm trong WHERE, chống 2 request huỷ đồng thời
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

// Controller
@Post(':id/cancel')
cancelOrder(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
  return this.ordersService.cancelOrder(id, user.id);
}
```
