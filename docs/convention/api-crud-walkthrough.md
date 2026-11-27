# CRUD walkthrough: tạo 1 resource từ đầu tới PR

> 📖 Quy tắc (vì sao, khi nào bắt buộc) nằm ở [api-rules.md](api-rules.md) — file này chỉ là các bước + code mẫu. Thiết kế DB đích: [`../architecture/11-database.md`](../architecture/11-database.md); cách viết schema/Prisma Client: [prisma-conventions.md](prisma-conventions.md).

Dùng placeholder **`Resource`/`resource`** — class và feature folder dùng số ít (`Product`, `product/`), route dùng số nhiều (`/products`). Business rule cụ thể của resource sống ở `../architecture/modules/<module>.md`.

Các ví dụ trong file này minh họa **trình tự các bước** cho resource CRUD generic. Code mẫu ở service/test (B5, phần test, phụ lục) đang gọi `PrismaService` trực tiếp và ném HTTP exception theo cách cũ; với module mới và module đã chuyển đổi, service phải gọi Persistence Port, ném lỗi từ `src/common/errors/` và mở giao dịch bằng `TransactionRunner` theo [module-architecture-conventions.md](module-architecture-conventions.md). Phần code mẫu sẽ được cập nhật khi các module được chuyển đổi.

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

Thực hiện migration, generate và seed theo [Prisma conventions §3, §5](prisma-conventions.md). Ở Prisma v7, `migrate dev` không tự chạy `generate`/seed. Chỉ dùng `migrate dev` trên database dev.

## B3. Scaffold

```bash
nest g resource modules/resource   # thay resource bằng feature name số ít; chọn REST API + CRUD entry points
```

Cấu trúc đích generic (ESM — **mọi import nội bộ có đuôi `.js`**):

```
src/modules/resource/
  dto/
    create-resource.dto.ts
    update-resource.dto.ts
  resource.controller.ts
  resource.service.ts
  resource.module.ts
```

Nest CLI có thể tạo cấu trúc theo tên resource; đặt các file trong feature folder theo [coding-style-conventions.md](coding-style-conventions.md). Sau CLI, xoá `entities/` và test rỗng; hoàn thiện validation/Swagger; dùng pagination dùng chung thay vì tạo bản riêng.

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
import { CreateResourceDto } from '#src/modules/resource/dto/create-resource.dto.js';

export class UpdateResourceDto extends PartialType(CreateResourceDto) {}
```

Quy tắc validation và DTO: [api-rules.md §R1](api-rules.md#r1-request-dto--validation).

## B5. Service

Quy tắc về Repository, lỗi và pre-fetch: [api-rules.md §R2–R3](api-rules.md#r2-service--use-case); Prisma Client và transaction: [prisma-conventions.md §4](prisma-conventions.md#4-prisma-client-trong-nestjs).

```ts
// resource.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Resource } from '#src/generated/prisma/client.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CreateResourceDto } from '#src/modules/resource/dto/create-resource.dto.js';
import { UpdateResourceDto } from '#src/modules/resource/dto/update-resource.dto.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';

@Injectable()
export class ResourceService {
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
    return this.prisma.resource.update({ where: { id }, data: updateResourceDto });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.resource.delete({ where: { id } });
  }
}
```

Nếu use case cần atomicity, xác định boundary theo [api-rules.md §R4](api-rules.md#r4-transaction) và [prisma-conventions.md §4.1](prisma-conventions.md#41-transaction).

## B6. Controller

Ranh giới controller, authorization và response DTO: [api-rules.md §R5, §R7](api-rules.md#r5-authorization-checkpoint).

```ts
// resource.controller.ts
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
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/security/authorization/permissions/authorize.decorator.js';
import { Permission } from '#src/security/contracts/permission.enum.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { ResourceService } from '#src/modules/resource/resource.service.js';
import { CreateResourceDto } from '#src/modules/resource/dto/create-resource.dto.js';
import { ResourceResponseDto, PaginatedResourceResponseDto } from '#src/modules/resource/dto/resource-response.dto.js';
import { UpdateResourceDto } from '#src/modules/resource/dto/update-resource.dto.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';

@ApiTags(API_TAGS.RESOURCES.name)
@Controller('resources')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  // Write (create/update/remove) → @Authorize gộp JWT + kiểm Quyền + Swagger bearer
  // khi resource cần bảo vệ (không phải mọi resource là public).
  @Post()
  @Authorize(Permission.RESOURCE_MANAGE)
  @ApiOperation({ summary: 'Create a new resource' })
  @ApiCreatedResponse({ type: ResourceResponseDto })
  create(@Body() createResourceDto: CreateResourceDto) {
    return this.resourceService.create(createResourceDto);
  }

  // Read → public nếu resource không cần bảo vệ, bỏ guard.
  @Get()
  @ApiOperation({ summary: 'List resources (paginated)' })
  @ApiOkResponse({ type: PaginatedResourceResponseDto })
  findAll(@Query() pagination: PaginationDto) {
    return this.resourceService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a resource by id' })
  @ApiOkResponse({ type: ResourceResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.resourceService.findOne(id);
  }

  @Patch(':id')
  @Authorize(Permission.RESOURCE_MANAGE)
  @ApiOperation({ summary: 'Update a resource' })
  @ApiOkResponse({ type: ResourceResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateResourceDto: UpdateResourceDto) {
    return this.resourceService.update(id, updateResourceDto);
  }

  @Delete(':id')
  @Authorize(Permission.RESOURCE_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a resource' })
  @ApiNoContentResponse({ description: 'Xoá thành công' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.resourceService.remove(id);
  }
}
```

Chi tiết route/status, authorization, error mapping và ID pipe nằm ở [api-rules.md §R1, §R5–R6](api-rules.md#r1-request-dto--validation).

## B7. Response DTO

Khai báo response DTO allow-list khi contract cần ổn định hoặc model có field không được công khai ([quy tắc §R7](api-rules.md#r7-response-dto--serialization)):

```ts
export class ResourceResponseDto {
  id: string;
  name: string;
  description: string | null;
}

export class PaginatedResourceResponseDto {
  data: ResourceResponseDto[];
  meta: PaginationMetaDto;
}
```

`PaginationMetaDto` được import từ `#src/common/pagination/pagination-meta.dto.js`.

## B8. Swagger

Quy tắc: [§R8](api-rules.md#r8-swagger--openapi). Mẫu:

```ts
// src/common/swagger/api-tags.ts — nguồn duy nhất, openapi.ts tự addTag từ đây
export const API_TAGS = {
  RESOURCES: { name: 'Resources', description: 'Resource CRUD — writes gated to MASTER_ADMIN, reads public' },
} as const;

@ApiTags(API_TAGS.RESOURCES.name)
@Controller('resources')
export class ResourceController { ... }

@Post('verify-email')
@ApiOperation({ summary: 'Verify email address using the 6-digit code sent by email' })
verify(@Body() dto: VerifyEmailDto) { ... }

@Get(':id')
@ApiOkResponse({ type: ResourceResponseDto })
@ApiErrorResponses(400, [404, 'Resource not found']) // body = ErrorResponseDto
findOne(@Param('id', ParseUUIDPipe) id: string) { ... }
```

Sau khi cập nhật endpoint, đồng bộ Postman theo [api-rules.md §R8](api-rules.md#r8-swagger--openapi).

## B9. Testing

Chiến lược và mức test cần có: [api-rules.md §R10](api-rules.md#r10-testing). Các ví dụ dưới đây minh họa cách dựng unit/e2e test trong repository.

### a. Service unit test

```ts
// resource.service.spec.ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceService } from '#src/modules/resource/resource.service.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';

describe('ResourceService', () => {
  let service: ResourceService;
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
      providers: [ResourceService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(ResourceService);
    vi.clearAllMocks();
  });

  it('findOne ném NotFoundException khi không tìm thấy', async () => {
    prismaMock.resource.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('create gọi prisma.resource.create với đúng data', async () => {
    const dto = { name: 'Học NestJS' };
    prismaMock.resource.create.mockResolvedValue({ id: '1', ...dto });
    const result = await service.create(dto);
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
import { AppModule } from '#src/app.module.js';
import { configureApp } from '#src/bootstrap/configure-app.js';

describe('Resources (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app); // dùng chung bootstrap với main.ts
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
- `configureApp()` đã dùng chung cho `main.ts` và e2e; filter được đăng ký qua `APP_FILTER`. Không lặp bootstrap config trong test.

---

## Phụ lục A — Lệnh CLI

### Nest CLI

- CRUD scaffold: `nest g resource modules/resource` — thay `resource` bằng tên feature số ít, chọn REST API và CRUD entry points ([B3](#b3-scaffold)).
- API nghiệp vụ: `nest g controller RESOURCE_NAME --no-spec` hoặc `nest g service RESOURCE_NAME --no-spec`.
- Chỉ dùng `nest g module RESOURCE_NAME` khi thực sự cần một Nest module mới. Kiểm tra folder/file đích theo [coding-style-conventions.md](coding-style-conventions.md).

### Prisma và npm scripts

Lệnh Prisma, kể cả `--config prisma7.config.ts`, nằm trong [prisma-conventions.md §7](prisma-conventions.md#7-lệnh-cli-hay-dùng). Các script dự án chuẩn được khai trong `package.json`; thường dùng `npm run test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck` và `npm run build`.

Sau khi cập nhật Swagger endpoint, đồng bộ Postman bằng `npm run start:dev` rồi `npm run postman:sync` ([api-rules.md §R8](api-rules.md#r8-swagger--openapi)).

Git/PR: xem [git-workflow.md](git-workflow.md).

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
