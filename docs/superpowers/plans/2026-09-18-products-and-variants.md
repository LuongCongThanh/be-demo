# Products + Product Variants Implementation Plan

> **Cho agent thực thi:** REQUIRED SUB-SKILL: dùng superpowers:subagent-driven-development (khuyến nghị) hoặc superpowers:executing-plans để thực thi plan này theo từng task. Các step dùng checkbox (`- [ ]`) để track tiến độ.

**Mục tiêu:** Build module `products` — CRUD `Product`, CRUD `ProductVariant` (nested dưới Product), và tự tạo dòng `Inventory` (quantity=0) trong cùng transaction khi tạo variant mới.

**Kiến trúc:** Module phẳng `src/products/` — 1 controller xử lý cả route Product và route Variant (nested resource, cùng owner module theo đúng "quyền sở hữu dữ liệu" ở Mục 2 tài liệu kiến trúc), 1 service chứa toàn bộ business logic (slug generation, category/product existence check, transaction tạo variant+inventory). Theo đúng pattern đã dùng ở Categories (`doc/categories-module-plan.md`) — không có Repository layer riêng, service gọi thẳng `PrismaService`.

**Tech Stack:** NestJS 12, Prisma 7, `slugify` (sinh slug từ tên, giống Category), `class-validator`/`class-transformer` (DTO), Vitest + `supertest` (test).

**Spec:** `docs/superpowers/specs/2026-09-18-products-and-variants-design.md`

**Tiền đề (phải xong trước khi bắt đầu plan này):**

- **Phase 1 đã hoàn tất** — route dưới `/api/v1/*`, role `MASTER_ADMIN`/`STORE_MANAGER` đã tồn tại trong DB (không còn `ADMIN`), env var bootstrap admin đã đổi tên thành `MASTER_ADMIN_BOOTSTRAP_EMAIL`/`MASTER_ADMIN_BOOTSTRAP_PASSWORD`. Plan này dùng thẳng các giá trị đó — nếu Phase 1 chưa xong, mọi ví dụ path/role/env var dưới đây sẽ sai.
- **Categories module đã build xong** (`doc/categories-module-plan.md`) — cần category thật tồn tại trong DB để test `categoryId` FK, không mock.

## Thuật ngữ (Glossary)

Plan này giả định bạn đã quen pattern CRUD NestJS từ việc build Categories (DTO/service/controller/test theo `docs/convention/api-conventions.md`). Chỉ giải thích thêm phần **mới so với Categories**:

- **Nested resource**: route dạng `/products/:id/variants` — variant luôn được truy cập qua context của 1 product cha (`:id` trong URL), khác với route top-level như `/products` hay `/categories`. Về code, route nested vẫn nằm trong cùng 1 controller (`ProductsController`), chỉ khác path decorator (`@Get(':id/variants')` thay vì `@Get()`).
- **Transaction (Prisma `$transaction`)**: 2 câu lệnh Prisma trở lên chạy trong 1 database transaction duy nhất — tất cả cùng thành công hoặc tất cả cùng bị rollback, không có trạng thái "nửa chừng" (vd. tạo được `ProductVariant` nhưng `Inventory` bị lỗi và không được tạo). Dùng ở đây vì tạo variant mà thiếu dòng inventory tương ứng là 1 trạng thái dữ liệu không hợp lệ theo thiết kế (Mục 3 tài liệu kiến trúc).
- **1:1 relation**: mỗi `ProductVariant` có tối đa 1 dòng `Inventory` tương ứng (cột `Inventory.variantId` có `@unique`) — khác 1:N như `Product` → `ProductVariant`.

## Global Constraints

- Module nghiệp vụ phẳng dưới `src/`, không tạo `src/products/entities/` (bị cấm — `docs/convention/api-conventions.md` §B3), không tạo `src/inventory/` (thuộc Phase 4, ngoài phạm vi).
- Không có barrel file (`index.ts`) — import trỏ thẳng tới file thật.
- Trong `src/**` (trừ `.spec.ts`), import luôn dùng relative + đuôi `.js` (ESM) — không dùng alias `@src/...` (chỉ dùng trong file test).
- Không dùng `any` mới — dùng type Prisma sinh ra (`import type { Product, ProductVariant } from '../generated/prisma/client.js'`).
- Không tự viết `PrismaExceptionFilter` mới — dùng `AllExceptionsFilter` đã có (global, qua `APP_FILTER`), pre-check ở service chỉ là UX layer, không thay thế unique/FK constraint ở DB.
- Không tạo Response DTO riêng cho `Product`/`ProductVariant` — cả 2 model không có field nhạy cảm, trả thẳng type Prisma (theo `docs/convention/api-conventions.md` §B11.a), giống Category.

---

### Task 1: Scaffold module `products`

**Files:**

- Create: `src/products/products.module.ts`
- Create: `src/products/products.controller.ts` (rỗng, điền dần ở Task 5/9)
- Create: `src/products/products.service.ts` (rỗng, điền dần ở Task 3/4/7/8)
- Modify: `src/app.module.ts` (CLI tự thêm `ProductsModule` vào `imports`)

**Interfaces:**

- Consumes: không phụ thuộc task nào khác.
- Produces: `ProductsModule`, `ProductsController`, `ProductsService` (rỗng) — mọi task sau đều sửa thêm vào các file này, không tạo file mới cùng vai trò.

- [ ] **Step 1: Chạy CLI scaffold**

Chạy: `nest g resource products`

Trả lời CLI prompt: transport = **REST API**, "Would you like to generate CRUD entry points?" = **Yes**.

- [ ] **Step 2: Dọn lại theo convention**

Chạy các lệnh sau:

```bash
rm -rf src/products/entities
rm src/products/products.controller.spec.ts src/products/products.service.spec.ts
```

Kiểm tra `src/products/products.module.ts` khớp đúng shape sau (sửa lại nếu CLI sinh khác):

```typescript
import { Module } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
```

Không cần import `PrismaModule` — đã `@Global()`.

- [ ] **Step 3: Build để xác nhận scaffold sạch**

Chạy: `npm run build`
Kỳ vọng: build thành công, không lỗi (logic bên trong còn rỗng, đó là bình thường ở bước này).

- [ ] **Step 4: Xác nhận `ProductsModule` đã tự thêm vào `AppModule`**

Chạy: `grep -n "ProductsModule" src/app.module.ts`
Kỳ vọng: có match trong cả import và `imports: [...]` — CLI tự làm bước này.

- [ ] **Step 5: Commit**

```bash
git add src/products/ src/app.module.ts
git commit -m "feat: scaffold products module"
```

---

### Task 2: Product DTO

**Files:**

- Create: `src/products/dto/create-product.dto.ts`
- Create: `src/products/dto/update-product.dto.ts`
- Create: `src/products/dto/pagination.dto.ts`
- Create: `src/products/dto/list-products-query.dto.ts`

**Interfaces:**

- Consumes: không phụ thuộc task nào khác.
- Produces: `CreateProductDto { name: string; categoryId: string }`, `UpdateProductDto` (mọi field optional + `status?`), `PaginationDto { page: number; limit: number }`, `ListProductsQueryDto extends PaginationDto { categoryId?: string; status?: ProductStatus }` — Task 3/4/5 dùng các type này.

- [ ] **Step 1: Viết `CreateProductDto`**

Tạo `src/products/dto/create-product.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ maxLength: 255 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'UUID của Category đã tồn tại' })
  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  // Không có field `slug` — server tự sinh từ `name` (Task 3). Không có
  // field `status` — mặc định ACTIVE ở DB, chỉ đổi được qua UpdateProductDto.
}
```

- [ ] **Step 2: Viết `UpdateProductDto`**

Tạo `src/products/dto/update-product.dto.ts`:

```typescript
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ProductStatus } from '../../generated/prisma/enums.js';
import { CreateProductDto } from './create-product.dto.js';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
```

- [ ] **Step 3: Xác nhận đường dẫn export enum của Prisma Client**

Đã verify trực tiếp: `src/generated/prisma/enums.ts` export `ProductStatus` (và `VariantStatus`, dùng ở Task 6) dưới dạng `export const ProductStatus = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' }` kèm `export type ProductStatus = ...` cùng tên (Prisma v7 sinh enum dạng const object + type alias, không phải TS `enum`) — import `../../generated/prisma/enums.js` ở Step 2 đúng, dùng được ngay với cả `@IsEnum(ProductStatus)` và `@ApiPropertyOptional({ enum: ProductStatus })` (cả 2 decorator nhận object thường, không yêu cầu TS `enum`). Không cần tự verify lại bước này.

Chạy: `npm run typecheck`
Kỳ vọng: PASS — xác nhận import/type resolve đúng trong toàn bộ file.

- [ ] **Step 4: Viết `PaginationDto` (copy nguyên từ Categories — cùng shape `{ page, limit }`)**

Tạo `src/products/dto/pagination.dto.ts`:

```typescript
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
  @Max(100)
  limit: number = 20;
}
```

- [ ] **Step 5: Viết `ListProductsQueryDto` (thêm filter `categoryId`/`status`, kế thừa pagination)**

Tạo `src/products/dto/list-products-query.dto.ts`:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ProductStatus } from '../../generated/prisma/enums.js';
import { PaginationDto } from './pagination.dto.js';

export class ListProductsQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
```

- [ ] **Step 6: Build để xác nhận DTO type-check sạch**

Chạy: `npm run typecheck`
Kỳ vọng: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/products/dto/
git commit -m "feat: add Product DTOs (create, update, list query, pagination)"
```

---

### Task 3: `ProductsService.create()` — sinh slug, kiểm tra category, chặn trùng slug

**Files:**

- Modify: `src/products/products.service.ts`
- Test: `src/products/products.service.spec.ts` (mới)

**Interfaces:**

- Consumes: `CreateProductDto` (Task 2), `PrismaService` (có sẵn).
- Produces: `ProductsService.create(dto: CreateProductDto): Promise<Product>` — ném `NotFoundException` nếu `categoryId` không tồn tại, `ConflictException` nếu trùng slug/`name`.

- [ ] **Step 1: Cài `slugify` (nếu Categories chưa cài trong repo này)**

Chạy: `grep -n '"slugify"' package.json || npm install slugify`

- [ ] **Step 2: Viết test fail cho `create()` — category không tồn tại**

Tạo `src/products/products.service.spec.ts`:

```typescript
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductsService } from './products.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ProductsService', () => {
  let service: ProductsService;
  const prismaMock = {
    category: { findUnique: vi.fn() },
    product: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productVariant: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(ProductsService);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('ném NotFoundException khi categoryId không tồn tại', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);

      await expect(service.create({ name: 'Áo thun', categoryId: 'missing-category-id' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it('ném ConflictException khi trùng slug', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prismaMock.product.findUnique.mockResolvedValue({ id: 'existing-product', slug: 'ao-thun' });

      await expect(service.create({ name: 'Áo Thun', categoryId: 'cat-1' })).rejects.toThrow(ConflictException);
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it('sinh đúng slug từ name và gọi prisma.product.create', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue({ id: 'p1', name: 'Áo Thun', slug: 'ao-thun', categoryId: 'cat-1' });

      const result = await service.create({ name: 'Áo Thun', categoryId: 'cat-1' });

      expect(prismaMock.product.create).toHaveBeenCalledWith({
        data: { name: 'Áo Thun', categoryId: 'cat-1', slug: 'ao-thun' },
      });
      expect(result.slug).toBe('ao-thun');
    });
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Chạy: `npx vitest run src/products/products.service.spec.ts`
Kỳ vọng: FAIL — `ProductsService` chưa có method `create()`.

- [ ] **Step 4: Viết `ProductsService.create()`**

Sửa `src/products/products.service.ts`:

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import type { Product, ProductVariant } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const category = await this.prisma.category.findUnique({ where: { id: createProductDto.categoryId } });
    if (!category) {
      throw new NotFoundException(`Category #${createProductDto.categoryId} not found`);
    }

    const slug = slugify(createProductDto.name, { lower: true, locale: 'vi', strict: true });
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Product name "${createProductDto.name}" already exists`);
    }

    return this.prisma.product.create({ data: { ...createProductDto, slug } });
  }
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Chạy: `npx vitest run src/products/products.service.spec.ts`
Kỳ vọng: PASS (cả 3 test trong `describe('create', ...)`).

- [ ] **Step 6: Commit**

```bash
git add src/products/products.service.ts src/products/products.service.spec.ts package.json package-lock.json
git commit -m "feat: implement ProductsService.create() with slug generation and category check"
```

---

### Task 4: `ProductsService` — `findAll`/`findOne`/`update`/`remove`

**Files:**

- Modify: `src/products/products.service.ts`
- Modify: `src/products/products.service.spec.ts`

**Interfaces:**

- Consumes: `ListProductsQueryDto`, `UpdateProductDto` (Task 2), `create()` đã có (Task 3).
- Produces: `findAll(query): Promise<{ data: Product[]; meta: {...} }>`, `findOne(id): Promise<Product>`, `update(id, dto): Promise<Product>`, `remove(id): Promise<void>`.

- [ ] **Step 1: Viết test fail cho `findOne`/`remove`**

Thêm vào `src/products/products.service.spec.ts` (trong cùng `describe('ProductsService', ...)`, sau `describe('create', ...)`):

```typescript
describe('findOne', () => {
  it('ném NotFoundException khi không tìm thấy', async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
  });
});

describe('update', () => {
  it('sinh lại slug khi đổi name, chặn trùng (loại trừ chính record đang sửa)', async () => {
    prismaMock.product.findUnique
      .mockResolvedValueOnce({ id: 'p1', name: 'Áo cũ', slug: 'ao-cu', categoryId: 'cat-1' }) // pre-fetch trong update()
      .mockResolvedValueOnce({ id: 'p1', slug: 'ao-moi' }); // check trùng slug mới — trùng chính nó, phải bỏ qua
    prismaMock.product.update.mockResolvedValue({ id: 'p1', name: 'Áo mới', slug: 'ao-moi' });

    const result = await service.update('p1', { name: 'Áo mới' });

    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { name: 'Áo mới', slug: 'ao-moi' },
    });
    expect(result.slug).toBe('ao-moi');
  });
});

describe('remove', () => {
  it('xoá product sau khi xác nhận tồn tại', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' });
    await service.remove('p1');
    expect(prismaMock.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Chạy: `npx vitest run src/products/products.service.spec.ts`
Kỳ vọng: FAIL — `findOne`/`update`/`remove` chưa tồn tại.

- [ ] **Step 3: Viết 3 method còn lại**

Sửa `src/products/products.service.ts` — thêm import và 3 method vào cuối class (giữ `create()` đã có ở Task 3):

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import type { Product, ProductVariant } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const category = await this.prisma.category.findUnique({ where: { id: createProductDto.categoryId } });
    if (!category) {
      throw new NotFoundException(`Category #${createProductDto.categoryId} not found`);
    }

    const slug = slugify(createProductDto.name, { lower: true, locale: 'vi', strict: true });
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Product name "${createProductDto.name}" already exists`);
    }

    return this.prisma.product.create({ data: { ...createProductDto, slug } });
  }

  async findAll({ page, limit, categoryId, status }: ListProductsQueryDto) {
    const where = { ...(categoryId && { categoryId }), ...(status && { status }) };
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const current = await this.findOne(id);

    if (updateProductDto.categoryId && updateProductDto.categoryId !== current.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: updateProductDto.categoryId } });
      if (!category) {
        throw new NotFoundException(`Category #${updateProductDto.categoryId} not found`);
      }
    }

    const data: UpdateProductDto & { slug?: string } = { ...updateProductDto };
    if (updateProductDto.name) {
      const slug = slugify(updateProductDto.name, { lower: true, locale: 'vi', strict: true });
      const existing = await this.prisma.product.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Product name "${updateProductDto.name}" already exists`);
      }
      data.slug = slug;
    }

    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Chạy: `npx vitest run src/products/products.service.spec.ts`
Kỳ vọng: PASS (toàn bộ file, kể cả test từ Task 3).

- [ ] **Step 5: Commit**

```bash
git add src/products/products.service.ts src/products/products.service.spec.ts
git commit -m "feat: implement ProductsService findAll/findOne/update/remove"
```

---

### Task 5: `ProductsController` — route Product

**Files:**

- Modify: `src/products/products.controller.ts`

**Interfaces:**

- Consumes: `ProductsService` (Task 3/4), `JwtAuthGuard`/`RolesGuard`/`Roles` decorator (có sẵn từ Auth module).
- Produces: `GET/POST /api/v1/products`, `GET/PATCH/DELETE /api/v1/products/:id`.

- [ ] **Step 1: Viết controller**

Sửa `src/products/products.controller.ts`:

```typescript
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
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Tạo product thành công' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOkResponse({ description: 'Danh sách product' })
  findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Chi tiết 1 product' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Cập nhật product thành công' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Xoá product thành công' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }
}
```

- [ ] **Step 2: Build**

Chạy: `npm run build`
Kỳ vọng: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/products/products.controller.ts
git commit -m "feat: add Product routes (CRUD, public reads, STORE_MANAGER/MASTER_ADMIN writes)"
```

(E2e test cho route này viết chung với Variant ở Task 10 — chạy được ngay bây giờ nếu muốn kiểm tra sớm, nhưng plan gộp lại để tránh 1 file e2e bị sửa 2 lần.)

---

### Task 6: Variant DTO

**Files:**

- Create: `src/products/dto/create-variant.dto.ts`
- Create: `src/products/dto/update-variant.dto.ts`

**Interfaces:**

- Consumes: không phụ thuộc task nào khác.
- Produces: `CreateVariantDto { sku: string; color?: string; size?: string; price: number }`, `UpdateVariantDto` (mọi field optional + `status?`).

- [ ] **Step 1: Viết `CreateVariantDto`**

Tạo `src/products/dto/create-variant.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreateVariantDto {
  @ApiProperty({ maxLength: 100, description: 'Client tự đặt theo quy ước riêng của store — không tự sinh' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  sku: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  size?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  // Không có field `productId` — lấy từ path param `:id` (Task 9), không từ body.
}
```

- [ ] **Step 2: Viết `UpdateVariantDto`**

Tạo `src/products/dto/update-variant.dto.ts`:

```typescript
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { VariantStatus } from '../../generated/prisma/enums.js';
import { CreateVariantDto } from './create-variant.dto.js';

export class UpdateVariantDto extends PartialType(CreateVariantDto) {
  @ApiPropertyOptional({ enum: VariantStatus })
  @IsOptional()
  @IsEnum(VariantStatus)
  status?: VariantStatus;
}
```

- [ ] **Step 3: Typecheck**

Chạy: `npm run typecheck`
Kỳ vọng: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/products/dto/create-variant.dto.ts src/products/dto/update-variant.dto.ts
git commit -m "feat: add ProductVariant DTOs"
```

---

### Task 7: `ProductsService.createVariant()` — transaction tạo variant + inventory

**Files:**

- Modify: `src/products/products.service.ts`
- Modify: `src/products/products.service.spec.ts`

**Interfaces:**

- Consumes: `CreateVariantDto` (Task 6), `findOne()` (Task 4, dùng để 404 khi product không tồn tại).
- Produces: `ProductsService.createVariant(productId: string, dto: CreateVariantDto): Promise<ProductVariant>` — tạo `ProductVariant` + `Inventory` (quantity=0, reservedQuantity=0) trong 1 transaction; ném `NotFoundException` nếu `productId` không tồn tại, `ConflictException` nếu trùng `sku`.

- [ ] **Step 1: Viết test fail**

Thêm vào `src/products/products.service.spec.ts`:

```typescript
describe('createVariant', () => {
  it('ném NotFoundException khi productId không tồn tại', async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);

    await expect(service.createVariant('missing-product-id', { sku: 'SKU-1', price: 100000 })).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('ném ConflictException khi trùng sku', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' });
    prismaMock.productVariant.findUnique.mockResolvedValue({ id: 'existing-variant', sku: 'SKU-1' });

    await expect(service.createVariant('p1', { sku: 'SKU-1', price: 100000 })).rejects.toThrow(ConflictException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('tạo variant + inventory (quantity=0) trong cùng 1 transaction', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' });
    prismaMock.productVariant.findUnique.mockResolvedValue(null);

    const createdVariant = { id: 'v1', productId: 'p1', sku: 'SKU-1', price: 100000 };
    const txVariantCreate = vi.fn().mockResolvedValue(createdVariant);
    const txInventoryCreate = vi
      .fn()
      .mockResolvedValue({ id: 'inv1', variantId: 'v1', quantity: 0, reservedQuantity: 0 });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ productVariant: { create: txVariantCreate }, inventory: { create: txInventoryCreate } }),
    );

    const result = await service.createVariant('p1', { sku: 'SKU-1', price: 100000 });

    expect(txVariantCreate).toHaveBeenCalledWith({ data: { sku: 'SKU-1', price: 100000, productId: 'p1' } });
    expect(txInventoryCreate).toHaveBeenCalledWith({ data: { variantId: 'v1', quantity: 0, reservedQuantity: 0 } });
    expect(result).toEqual(createdVariant);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Chạy: `npx vitest run src/products/products.service.spec.ts`
Kỳ vọng: FAIL — `createVariant` chưa tồn tại.

- [ ] **Step 3: Viết `createVariant()`**

Thêm method vào `src/products/products.service.ts` (thêm import `CreateVariantDto`):

```typescript
import { CreateVariantDto } from './dto/create-variant.dto.js';

// ... trong class ProductsService, thêm sau các method Product:

  async createVariant(productId: string, createVariantDto: CreateVariantDto): Promise<ProductVariant> {
    await this.findOne(productId); // 404 nếu product không tồn tại

    const existing = await this.prisma.productVariant.findUnique({ where: { sku: createVariantDto.sku } });
    if (existing) {
      throw new ConflictException(`SKU "${createVariantDto.sku}" already exists`);
    }

    // Transaction: variant và inventory (quantity=0) phải cùng tồn tại hoặc
    // cùng không tồn tại — không có trạng thái "có variant nhưng thiếu
    // inventory" (Mục 3 tài liệu kiến trúc). Inventory module (Phase 4) chỉ
    // đọc/điều chỉnh dòng này, không phải nơi tạo dòng đầu tiên.
    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({ data: { ...createVariantDto, productId } });
      await tx.inventory.create({ data: { variantId: variant.id, quantity: 0, reservedQuantity: 0 } });
      return variant;
    });
  }
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Chạy: `npx vitest run src/products/products.service.spec.ts`
Kỳ vọng: PASS (toàn bộ file).

- [ ] **Step 5: Commit**

```bash
git add src/products/products.service.ts src/products/products.service.spec.ts
git commit -m "feat: create Inventory row atomically when creating a ProductVariant"
```

---

### Task 8: `ProductsService` — `findAllVariants`/`findOneVariant`/`updateVariant`/`removeVariant`

**Files:**

- Modify: `src/products/products.service.ts`
- Modify: `src/products/products.service.spec.ts`

**Interfaces:**

- Consumes: `UpdateVariantDto` (Task 6), `createVariant()` đã có (Task 7).
- Produces: `findAllVariants(productId, pagination)`, `findOneVariant(productId, variantId)`, `updateVariant(productId, variantId, dto)`, `removeVariant(productId, variantId)`.

- [ ] **Step 1: Viết test fail**

Thêm vào `src/products/products.service.spec.ts`:

```typescript
describe('findOneVariant', () => {
  it('ném NotFoundException khi variant không tồn tại hoặc không thuộc product này', async () => {
    // findOneVariant() chỉ query productVariant.findFirst({ where: { id, productId } })
    // — không cần product.findUnique riêng, vì where đã lọc theo cả 2 điều kiện cùng lúc.
    prismaMock.productVariant.findFirst.mockResolvedValue(null);

    await expect(service.findOneVariant('p1', 'missing-variant')).rejects.toThrow(NotFoundException);
  });
});

describe('updateVariant', () => {
  it('chặn trùng sku khi đổi sku (loại trừ chính record đang sửa)', async () => {
    prismaMock.productVariant.findFirst.mockResolvedValueOnce({ id: 'v1', productId: 'p1', sku: 'SKU-OLD' });
    prismaMock.productVariant.findUnique.mockResolvedValueOnce({ id: 'v1', sku: 'SKU-NEW' });
    prismaMock.productVariant.update.mockResolvedValue({ id: 'v1', sku: 'SKU-NEW' });

    const result = await service.updateVariant('p1', 'v1', { sku: 'SKU-NEW' });

    expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { sku: 'SKU-NEW' },
    });
    expect(result.sku).toBe('SKU-NEW');
  });
});

describe('removeVariant', () => {
  it('xoá variant sau khi xác nhận thuộc đúng product', async () => {
    prismaMock.productVariant.findFirst.mockResolvedValue({ id: 'v1', productId: 'p1' });

    await service.removeVariant('p1', 'v1');

    expect(prismaMock.productVariant.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Chạy: `npx vitest run src/products/products.service.spec.ts`
Kỳ vọng: FAIL — 3 method chưa tồn tại.

- [ ] **Step 3: Viết 4 method còn lại**

Thêm vào `src/products/products.service.ts` (thêm import `UpdateVariantDto`, `PaginationDto`):

```typescript
import { UpdateVariantDto } from './dto/update-variant.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';

// ... trong class ProductsService, thêm sau createVariant():

  async findAllVariants(productId: string, { page, limit }: PaginationDto) {
    await this.findOne(productId); // 404 nếu product không tồn tại

    const where = { productId };
    const [data, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.productVariant.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneVariant(productId: string, variantId: string): Promise<ProductVariant> {
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) {
      throw new NotFoundException(`Variant #${variantId} not found on product #${productId}`);
    }
    return variant;
  }

  async updateVariant(productId: string, variantId: string, updateVariantDto: UpdateVariantDto): Promise<ProductVariant> {
    await this.findOneVariant(productId, variantId); // 404 nếu không thuộc đúng product

    if (updateVariantDto.sku) {
      const existing = await this.prisma.productVariant.findUnique({ where: { sku: updateVariantDto.sku } });
      if (existing && existing.id !== variantId) {
        throw new ConflictException(`SKU "${updateVariantDto.sku}" already exists`);
      }
    }

    return this.prisma.productVariant.update({ where: { id: variantId }, data: updateVariantDto });
  }

  async removeVariant(productId: string, variantId: string): Promise<void> {
    await this.findOneVariant(productId, variantId);
    await this.prisma.productVariant.delete({ where: { id: variantId } });
  }
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Chạy: `npx vitest run src/products/products.service.spec.ts`
Kỳ vọng: PASS (toàn bộ file).

- [ ] **Step 5: Commit**

```bash
git add src/products/products.service.ts src/products/products.service.spec.ts
git commit -m "feat: implement ProductsService findAllVariants/findOneVariant/updateVariant/removeVariant"
```

---

### Task 9: `ProductsController` — route Variant (nested)

**Files:**

- Modify: `src/products/products.controller.ts`

**Interfaces:**

- Consumes: `ProductsService` variant method (Task 7/8), `CreateVariantDto`/`UpdateVariantDto` (Task 6).
- Produces: `GET/POST /api/v1/products/:id/variants`, `GET/PATCH/DELETE /api/v1/products/:id/variants/:variantId`.

- [ ] **Step 1: Thêm route variant vào controller**

Sửa `src/products/products.controller.ts` — thêm import và 5 method vào cuối class (giữ nguyên route Product đã có ở Task 5):

```typescript
import { CreateVariantDto } from './dto/create-variant.dto.js';
import { UpdateVariantDto } from './dto/update-variant.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';

// ... trong class ProductsController, thêm sau remove():

  @Post(':id/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Tạo variant (kèm inventory) thành công' })
  createVariant(@Param('id', ParseUUIDPipe) productId: string, @Body() createVariantDto: CreateVariantDto) {
    return this.productsService.createVariant(productId, createVariantDto);
  }

  @Get(':id/variants')
  @ApiOkResponse({ description: 'Danh sách variant của 1 product' })
  findAllVariants(@Param('id', ParseUUIDPipe) productId: string, @Query() pagination: PaginationDto) {
    return this.productsService.findAllVariants(productId, pagination);
  }

  @Get(':id/variants/:variantId')
  @ApiOkResponse({ description: 'Chi tiết 1 variant' })
  findOneVariant(
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.productsService.findOneVariant(productId, variantId);
  }

  @Patch(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Cập nhật variant thành công' })
  updateVariant(
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() updateVariantDto: UpdateVariantDto,
  ) {
    return this.productsService.updateVariant(productId, variantId, updateVariantDto);
  }

  @Delete(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Xoá variant thành công' })
  removeVariant(
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.productsService.removeVariant(productId, variantId);
  }
```

- [ ] **Step 2: Build**

Chạy: `npm run build`
Kỳ vọng: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/products/products.controller.ts
git commit -m "feat: add ProductVariant nested routes under /products/:id/variants"
```

---

### Task 10: E2e test — full flow Product + Variant + Inventory

**Files:**

- Create: `test/products.e2e-spec.ts`

**Interfaces:**

- Consumes: toàn bộ `ProductsController`/`ProductsService` (Task 3-9), `POST /api/v1/auth/login` (Auth module, có sẵn), `PrismaService` (để query trực tiếp xác nhận dòng `inventory`).
- Produces: không có task nào sau tiêu thụ — đây là task xác nhận cuối.

- [ ] **Step 1: Viết e2e test**

Tạo `test/products.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { createTestApp } from './support/create-test-app.js';

describe('Products + Variants (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let masterAdminAccessToken: string;
  let categoryId: string;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: process.env.MASTER_ADMIN_BOOTSTRAP_EMAIL,
        password: process.env.MASTER_ADMIN_BOOTSTRAP_PASSWORD,
      })
      .expect(200);
    masterAdminAccessToken = loginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { name: `Products e2e category ${Date.now()}`, slug: `products-e2e-category-${Date.now()}` },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/products không có Bearer token trả 401', async () => {
    await request(app.getHttpServer()).post('/api/v1/products').send({ name: 'x', categoryId }).expect(401);
  });

  it('POST /api/v1/products với categoryId không tồn tại trả 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `Product ${Date.now()}`, categoryId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });

  it('POST /api/v1/products tạo thành công, trả 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `Product ${Date.now()}`, categoryId })
      .expect(201);

    expect(res.body).toMatchObject({ categoryId, slug: expect.stringContaining('product') });
  });

  it('POST /api/v1/products trùng name trả 409', async () => {
    const name = `Duplicate product ${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name, categoryId })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name, categoryId })
      .expect(409);
  });

  it('GET /api/v1/products/:id trả 404 khi không tồn tại', async () => {
    await request(app.getHttpServer()).get('/api/v1/products/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('tạo variant tự động tạo kèm dòng inventory (quantity=0) trong 1 transaction', async () => {
    const productRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `Product with variant ${Date.now()}`, categoryId })
      .expect(201);
    const productId = productRes.body.id;

    const variantRes = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/variants`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ sku: `SKU-${Date.now()}`, price: 150000 })
      .expect(201);
    const variantId = variantRes.body.id;

    const inventory = await prisma.inventory.findUnique({ where: { variantId } });
    expect(inventory).toMatchObject({ variantId, quantity: 0, reservedQuantity: 0 });
  });

  it('tạo variant với sku trùng trả 409', async () => {
    const productRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `Product dup sku ${Date.now()}`, categoryId })
      .expect(201);
    const productId = productRes.body.id;
    const sku = `SKU-DUP-${Date.now()}`;

    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/variants`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ sku, price: 100000 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/variants`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ sku, price: 100000 })
      .expect(409);
  });

  it('GET /api/v1/products/:id/variants/:variantId trả 404 khi variantId thuộc product khác', async () => {
    const productARes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `Product A ${Date.now()}`, categoryId })
      .expect(201);
    const productBRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `Product B ${Date.now()}`, categoryId })
      .expect(201);

    const variantOfARes = await request(app.getHttpServer())
      .post(`/api/v1/products/${productARes.body.id}/variants`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ sku: `SKU-A-${Date.now()}`, price: 100000 })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/products/${productBRes.body.id}/variants/${variantOfARes.body.id}`)
      .expect(404);
  });
});
```

- [ ] **Step 2: Chạy e2e test**

Chạy: `npm run test:e2e -- products`
Kỳ vọng: PASS (tất cả 8 test).

- [ ] **Step 3: Chạy toàn bộ e2e suite, xác nhận không regression**

Chạy: `npm run test:e2e`
Kỳ vọng: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/products.e2e-spec.ts
git commit -m "test: add e2e coverage for Products + Variants + Inventory creation"
```

---

### Task 11: Swagger + Postman sync + Definition of Done

**Files:**

- Modify: `src/products/products.controller.ts` (đã có decorator Swagger từ Task 5/9 — task này chỉ verify + sync)

**Interfaces:**

- Consumes: `ProductsController` hoàn chỉnh (Task 5-9).
- Produces: Postman collection cập nhật, checklist hoàn tất.

- [ ] **Step 1: Chạy app, xác nhận Swagger hiển thị đủ route**

Chạy: `npm run start:dev` (chạy nền hoặc terminal riêng)

Mở `http://localhost:3000/docs`, kỳ vọng thấy đủ 10 route dưới tag `products`: 5 route Product + 5 route Variant, đúng request/response shape.

- [ ] **Step 2: Đồng bộ Postman**

Chạy: `npm run postman:sync`
Kỳ vọng: script chạy thành công, không lỗi (cần `POSTMAN_API_KEY`/`POSTMAN_COLLECTION_ID` đã set trong `.env`).

- [ ] **Step 3: Lint / Format / Build sạch**

Chạy:

```bash
npm run lint
npm run format
npm run build
```

Kỳ vọng: cả 3 lệnh chạy sạch, không lỗi.

- [ ] **Step 4: Chạy lại toàn bộ test suite lần cuối**

Chạy: `npm run test && npm run test:e2e`
Kỳ vọng: PASS toàn bộ.

- [ ] **Step 5: Commit cuối (nếu Step 1-4 có sửa gì)**

```bash
git add -A
git commit -m "chore: sync Postman collection for Products + Variants" --allow-empty
```

## Final Verification Checklist

- [ ] `npm run lint` — pass
- [ ] `npm run typecheck` — pass
- [ ] `npm run test` — toàn bộ unit test pass (bao gồm `products.service.spec.ts`)
- [ ] `npm run test:e2e` — toàn bộ e2e test pass (bao gồm `products.e2e-spec.ts`)
- [ ] `curl -X POST http://localhost:3000/api/v1/products` không kèm Bearer token → `401`
- [ ] Tạo Product với `categoryId` không tồn tại → `404`
- [ ] Tạo 2 Product cùng `name` → lần 2 nhận `409`
- [ ] Tạo `ProductVariant` mới → query `SELECT * FROM inventory WHERE variant_id = '<id>'` → đúng 1 dòng, `quantity = 0`
- [ ] Tạo 2 `ProductVariant` cùng `sku` (dù thuộc 2 product khác nhau) → lần 2 nhận `409` (SKU unique toàn hệ thống, không phải theo từng product)
- [ ] `GET /api/v1/products/:id/variants/:variantId` với `variantId` thuộc product khác → `404`
- [ ] `http://localhost:3000/docs` hiển thị đủ 10 route dưới tag `products`
- [ ] Không có file nào tạo dưới `src/inventory/` — module đó thuộc Phase 4
