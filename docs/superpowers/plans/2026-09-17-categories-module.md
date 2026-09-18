# Categories Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full CRUD for the `categories` resource (`GET` public, writes for STORE_MANAGER or MASTER_ADMIN) with server-generated slugs and FK-safe delete, reusing the existing Auth guards.

**Architecture:** A NestJS resource module (`CategoriesModule`) under `src/categories/`, following this project's established CRUD convention: `Controller → Service → PrismaService`, no repository layer, no `entities/` folder (Prisma type returned directly — `Category` has no sensitive fields). Slug generation and the two business rules (duplicate-name conflict, FK-safe delete) live entirely in `CategoriesService`. Write endpoints reuse the existing `JwtAuthGuard` + `RolesGuard` with `STORE_MANAGER` or `MASTER_ADMIN` (ADR 0005).

**Tech Stack:** NestJS 12, Prisma Client (generated to `src/generated/prisma`), `class-validator` / `class-transformer` for DTOs, `slugify` for slug generation, Vitest + Supertest for unit/e2e tests.

**Spec:** `doc/categories-module-plan.md` (high-level step plan) + `../../convention` §B (CRUD convention, canonical code samples) + `docs/adr/0001-category-delete-restrict.md` (delete business rule)

## Global Constraints

- Runtime-facing strings (exception messages) are in English; explanatory code comments are in Vietnamese (established project convention).
- ESM: every internal import ends in `.js`, even when importing from a `.ts` file.
- `slug` is never accepted from the client — always server-generated from `name` via `slugify(name, { lower: true, locale: 'vi', strict: true })`.
- Duplicate `name` (→ duplicate slug) → `409 Conflict`. Never auto-append a numeric suffix.
- Editing `name` regenerates the `slug` (old links may 404 — no redirect mechanism in this MVP).
- Category delete is blocked with `409` while any `product.categoryId` references it — no cascade, no `SET NULL` ([ADR 0001](../../../docs/adr/0001-category-delete-restrict.md)).
- Writes require `JwtAuthGuard` + `@Roles('STORE_MANAGER', 'MASTER_ADMIN')`. Reads are public. Runtime URLs are under `/api/v1/categories` after ADR 0002 is implemented.
- `GET /categories` is paginated (`{ page, limit }` query → `{ data, meta }` response) even though category counts are small — for response-shape consistency across resources.
- `PrismaModule` is `@Global()` (`src/prisma/prisma.module.ts`) — never add it to a feature module's `imports`.

---

## Task 1: Category DTOs

**Files:**

- Create: `src/categories/dto/create-category.dto.ts`
- Create: `src/categories/dto/update-category.dto.ts`
- Create: `src/categories/dto/pagination.dto.ts`
- Create: `src/categories/dto/category-response.dto.ts`
- Test: `src/categories/dto/create-category.dto.spec.ts`
- Test: `src/categories/dto/pagination.dto.spec.ts`

**Interfaces:**

- Consumes: nothing (first task)
- Produces (consumed by Task 2 and Task 3):
  - `CreateCategoryDto { name: string; description?: string }`
  - `UpdateCategoryDto` = `PartialType(CreateCategoryDto)` → `{ name?: string; description?: string }`
  - `PaginationDto { page: number (default 1); limit: number (default 20, max 100) }`
  - `CategoryResponseDto { id: string; name: string; slug: string; description: string | null; createdAt: Date; updatedAt: Date }` (Swagger typing only — the controller returns the Prisma `Category` object directly, this class just gives OpenAPI a shape to document)

- [ ] **Step 1: Write the failing test for `CreateCategoryDto`**

```ts
// src/categories/dto/create-category.dto.spec.ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCategoryDto } from './create-category.dto.js';

describe('CreateCategoryDto', () => {
  it('fails validation when name is missing', async () => {
    const dto = plainToInstance(CreateCategoryDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails validation when name exceeds 150 characters', async () => {
    const dto = plainToInstance(CreateCategoryDto, { name: 'a'.repeat(151) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('passes validation with only name (description optional)', async () => {
    const dto = plainToInstance(CreateCategoryDto, { name: 'Shoes' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes validation with name and description', async () => {
    const dto = plainToInstance(CreateCategoryDto, { name: 'Shoes', description: 'Footwear' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/categories/dto/create-category.dto.spec.ts`
Expected: FAIL — `Cannot find module './create-category.dto.js'` (file doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation — `CreateCategoryDto` + `UpdateCategoryDto`**

```ts
// src/categories/dto/create-category.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ maxLength: 150 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  name: string;

  // No `slug` field — the server derives it from `name` (see CategoriesService,
  // Task 2). A client-sent `slug` is rejected with 400 by the global
  // ValidationPipe (`forbidNonWhitelisted: true`), not silently dropped.

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
```

```ts
// src/categories/dto/update-category.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto.js';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/categories/dto/create-category.dto.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing test for `PaginationDto`**

```ts
// src/categories/dto/pagination.dto.spec.ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PaginationDto } from './pagination.dto.js';

describe('PaginationDto', () => {
  it('defaults page to 1 and limit to 20 when omitted', () => {
    const dto = plainToInstance(PaginationDto, {});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('coerces string query values to numbers', () => {
    const dto = plainToInstance(PaginationDto, { page: '2', limit: '50' });
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });

  it('fails validation when limit exceeds 100', async () => {
    const dto = plainToInstance(PaginationDto, { limit: '1000000' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('fails validation when page is less than 1', async () => {
    const dto = plainToInstance(PaginationDto, { page: '0' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test -- src/categories/dto/pagination.dto.spec.ts`
Expected: FAIL — `Cannot find module './pagination.dto.js'`

- [ ] **Step 7: Write the minimal implementation — `PaginationDto`**

```ts
// src/categories/dto/pagination.dto.ts
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
  @Max(100) // blocks a client requesting ?limit=1000000 and overloading the DB
  limit: number = 20;
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test -- src/categories/dto/pagination.dto.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Write `CategoryResponseDto` (Swagger typing only, no test — pure data shape, no behavior to assert)**

```ts
// src/categories/dto/category-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
```

- [ ] **Step 10: Commit**

```bash
git add src/categories/dto/
git commit -m "feat(categories): add Category DTOs (create/update/pagination/response)"
```

---

## Task 2: CategoriesService — business logic

**Files:**

- Create: `src/categories/categories.service.ts`
- Test: `src/categories/categories.service.spec.ts`
- Modify: `package.json` (add `slugify` dependency)

**Interfaces:**

- Consumes: `CreateCategoryDto`, `UpdateCategoryDto`, `PaginationDto` (Task 1); `PrismaService` (`src/prisma/prisma.service.ts`, already exists)
- Produces (consumed directly by Task 3):
  - `create(dto: CreateCategoryDto): Promise<Category>`
  - `findAll(pagination: PaginationDto): Promise<{ data: Category[]; meta: { page: number; limit: number; total: number; totalPages: number } }>`
  - `findOne(id: string): Promise<Category>`
  - `update(id: string, dto: UpdateCategoryDto): Promise<Category>`
  - `remove(id: string): Promise<void>`

- [ ] **Step 1: Install `slugify`**

Run: `npm install slugify`
Expected: `package.json` `dependencies` gains `"slugify"`.

- [ ] **Step 2: Write the failing test for `create()`**

```ts
// src/categories/categories.service.spec.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { CategoriesService } from './categories.service.js';

describe('CategoriesService', () => {
  let service: CategoriesService;
  const prismaMock = {
    category: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    product: {
      count: vi.fn(),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(CategoriesService);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('generates a slug from name and creates the category', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);
      prismaMock.category.create.mockResolvedValue({ id: '1', name: 'Shoes', slug: 'shoes', description: null });

      const result = await service.create({ name: 'Shoes' });

      expect(prismaMock.category.findUnique).toHaveBeenCalledWith({ where: { slug: 'shoes' } });
      expect(prismaMock.category.create).toHaveBeenCalledWith({ data: { name: 'Shoes', slug: 'shoes' } });
      expect(result.slug).toBe('shoes');
    });

    it('throws ConflictException when the generated slug already exists', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'existing', name: 'Shoes', slug: 'shoes' });

      await expect(service.create({ name: 'Shoes' })).rejects.toThrow(ConflictException);
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- src/categories/categories.service.spec.ts`
Expected: FAIL — `Cannot find module './categories.service.js'`

- [ ] **Step 4: Write the minimal implementation for `create()`**

```ts
// src/categories/categories.service.ts
import { ConflictException, Injectable } from '@nestjs/common';
import slugify from 'slugify';
import type { Category } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const slug = slugify(createCategoryDto.name, { lower: true, locale: 'vi', strict: true });

    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) {
      // Duplicate name (=> duplicate slug) is rejected outright — never
      // auto-append a numeric suffix (design decision: no silent renaming).
      throw new ConflictException(`Category name "${createCategoryDto.name}" already exists`);
    }

    return this.prisma.category.create({ data: { ...createCategoryDto, slug } });
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/categories/categories.service.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Write the failing test for `findAll()` and `findOne()`**

Add these `describe` blocks inside the existing `describe('CategoriesService', ...)` block, after `create`:

```ts
describe('findAll', () => {
  it('returns paginated data with meta', async () => {
    prismaMock.category.findMany.mockResolvedValue([{ id: '1', name: 'Shoes', slug: 'shoes' }]);
    prismaMock.category.count.mockResolvedValue(1);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(prismaMock.category.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(result).toEqual({
      data: [{ id: '1', name: 'Shoes', slug: 'shoes' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('computes the correct skip for page > 1', async () => {
    prismaMock.category.findMany.mockResolvedValue([]);
    prismaMock.category.count.mockResolvedValue(45);

    await service.findAll({ page: 3, limit: 20 });

    expect(prismaMock.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
  });
});

describe('findOne', () => {
  it('returns the category when found', async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: '1', name: 'Shoes', slug: 'shoes' });
    const result = await service.findOne('1');
    expect(result).toEqual({ id: '1', name: 'Shoes', slug: 'shoes' });
  });

  it('throws NotFoundException when not found', async () => {
    prismaMock.category.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm run test -- src/categories/categories.service.spec.ts`
Expected: FAIL — `service.findAll is not a function`, `service.findOne is not a function`

- [ ] **Step 8: Implement `findAll()` and `findOne()`**

Update the imports at the top of `src/categories/categories.service.ts`:

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import type { Category } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';
```

Add inside the class, after `create()`:

```ts
  async findAll(pagination: PaginationDto) {
    const { page, limit } = pagination;
    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        skip: (page - 1) * limit,
        take: limit,
        // createdAt can collide within the same millisecond — id is always
        // added as a tie-breaker so pagination stays deterministic.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.category.count(),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm run test -- src/categories/categories.service.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 10: Write the failing test for `update()`**

Add inside the existing `describe('CategoriesService', ...)` block, after `findOne`:

```ts
describe('update', () => {
  it('regenerates the slug when name changes', async () => {
    prismaMock.category.findUnique
      .mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' }) // findOne() pre-fetch
      .mockResolvedValueOnce(null); // slug uniqueness check
    prismaMock.category.update.mockResolvedValue({ id: '1', name: 'Sneakers', slug: 'sneakers' });

    const result = await service.update('1', { name: 'Sneakers' });

    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { name: 'Sneakers', slug: 'sneakers' },
    });
    expect(result.slug).toBe('sneakers');
  });

  it('throws ConflictException when the new name collides with a different category', async () => {
    prismaMock.category.findUnique
      .mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' })
      .mockResolvedValueOnce({ id: '2', name: 'Sneakers', slug: 'sneakers' });

    await expect(service.update('1', { name: 'Sneakers' })).rejects.toThrow(ConflictException);
  });

  it('does not touch the slug when name is not part of the update', async () => {
    prismaMock.category.findUnique.mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' });
    prismaMock.category.update.mockResolvedValue({ id: '1', name: 'Shoes', slug: 'shoes', description: 'Updated' });

    await service.update('1', { description: 'Updated' });

    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { description: 'Updated' },
    });
  });

  it('throws NotFoundException when the category does not exist', async () => {
    prismaMock.category.findUnique.mockResolvedValueOnce(null);
    await expect(service.update('missing-id', { name: 'X' })).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 11: Run the test to verify it fails**

Run: `npm run test -- src/categories/categories.service.spec.ts`
Expected: FAIL — `service.update is not a function`

- [ ] **Step 12: Implement `update()`**

Add to the imports:

```ts
import { UpdateCategoryDto } from './dto/update-category.dto.js';
```

Add inside the class, after `findOne()`:

```ts
  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    await this.findOne(id); // 404 pre-fetch — also needed below for the slug-collision check

    const data: UpdateCategoryDto & { slug?: string } = { ...updateCategoryDto };
    if (updateCategoryDto.name) {
      const slug = slugify(updateCategoryDto.name, { lower: true, locale: 'vi', strict: true });
      const existing = await this.prisma.category.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Category name "${updateCategoryDto.name}" already exists`);
      }
      data.slug = slug;
    }

    return this.prisma.category.update({ where: { id }, data });
  }
```

- [ ] **Step 13: Run the test to verify it passes**

Run: `npm run test -- src/categories/categories.service.spec.ts`
Expected: PASS (10 tests)

- [ ] **Step 14: Write the failing test for `remove()`**

Add inside the existing `describe('CategoriesService', ...)` block, after `update`:

```ts
describe('remove', () => {
  it('deletes the category when no products reference it', async () => {
    prismaMock.category.findUnique.mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' });
    prismaMock.product.count.mockResolvedValue(0);
    prismaMock.category.delete.mockResolvedValue(undefined);

    await service.remove('1');

    expect(prismaMock.product.count).toHaveBeenCalledWith({ where: { categoryId: '1' } });
    expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('throws ConflictException when products still reference the category', async () => {
    prismaMock.category.findUnique.mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' });
    prismaMock.product.count.mockResolvedValue(3);

    await expect(service.remove('1')).rejects.toThrow(ConflictException);
    expect(prismaMock.category.delete).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the category does not exist', async () => {
    prismaMock.category.findUnique.mockResolvedValueOnce(null);
    await expect(service.remove('missing-id')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 15: Run the test to verify it fails**

Run: `npm run test -- src/categories/categories.service.spec.ts`
Expected: FAIL — `service.remove is not a function`

- [ ] **Step 16: Implement `remove()`**

Add inside the class, after `update()`:

```ts
  async remove(id: string): Promise<void> {
    await this.findOne(id);

    // ADR 0001: products.categoryId -> categories.id is RESTRICT at the DB
    // level. Pre-check and return a clear 409 with the blocking count
    // instead of letting a raw FK violation (P2003) surface as a 500.
    const productCount = await this.prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new ConflictException(
        `Category still has ${productCount} product(s) — reassign them before deleting`,
      );
    }

    await this.prisma.category.delete({ where: { id } });
  }
```

- [ ] **Step 17: Run the full service test suite to verify it passes**

Run: `npm run test -- src/categories/categories.service.spec.ts`
Expected: PASS (13 tests)

- [ ] **Step 18: Commit**

```bash
git add package.json package-lock.json src/categories/categories.service.ts src/categories/categories.service.spec.ts
git commit -m "feat(categories): add CategoriesService (slug generation, conflict handling, FK-safe delete)"
```

---

## Task 3: CategoriesController + CategoriesModule (routes, guards, Swagger)

**Files:**

- Create: `src/categories/categories.controller.ts`
- Create: `src/categories/categories.module.ts`
- Modify: `src/app.module.ts`

**Interfaces:**

- Consumes: `CategoriesService` (Task 2); `JwtAuthGuard` (`src/auth/guards/jwt-auth.guard.ts`), `RolesGuard` (`src/auth/guards/roles.guard.ts`), `Roles` decorator (`src/auth/decorators/roles.decorator.ts`) — all already implemented
- Produces (consumed by Task 4): mounted routes `GET/POST /categories`, `GET/PATCH/DELETE /categories/:id`

> This task's real test cycle is the e2e suite in Task 4 — a thin controller (route → guard → delegate to service) has no meaningful unit-test surface beyond "does it call the service," which is low-value (see `../../convention` §8). The steps below still verify locally with `curl` before Task 4 provides the authoritative automated check.
>
> Alternative to Steps 1–2: run `nest g resource categories` (transport: REST API, "generate CRUD entry points": Yes) and replace the generated `categories.controller.ts`/`categories.module.ts` content with what's below, then delete the generated `entities/` folder and empty `*.spec.ts` files. Either path produces the same result — the code below is the source of truth.

- [ ] **Step 1: Write the controller**

```ts
// src/categories/categories.controller.ts
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
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';
import { CategoryResponseDto } from './dto/category-response.dto.js';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: CategoryResponseDto })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOkResponse({ description: 'Paginated category list' })
  findAll(@Query() pagination: PaginationDto) {
    return this.categoriesService.findAll(pagination);
  }

  @Get(':id')
  @ApiOkResponse({ type: CategoryResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOkResponse({ type: CategoryResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
```

- [ ] **Step 2: Write the module**

```ts
// src/categories/categories.module.ts
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
```

> No `imports` needed — `PrismaModule` is `@Global()` (`src/prisma/prisma.module.ts`), so `PrismaService` is already injectable here.

- [ ] **Step 3: Register the module in `AppModule`**

Modify `src/app.module.ts` — add the import and the entry in `imports`:

```ts
import { CategoriesModule } from './categories/categories.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 20 }]),
    PrismaModule,
    AuthModule,
    CategoriesModule,
  ],
  // controllers/providers unchanged
})
export class AppModule {}
```

- [ ] **Step 4: Verify the app boots and the route is mounted**

Run: `npm run build && npm run start:dev`
Then, in another terminal: `curl http://localhost:3000/categories`
Expected: `200` with body `{"data":[],"meta":{"page":1,"limit":20,"total":0,"totalPages":0}}` (empty DB) — not `404`. Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 5: Commit**

```bash
git add src/categories/categories.controller.ts src/categories/categories.module.ts src/app.module.ts
git commit -m "feat(categories): wire CategoriesController + CategoriesModule into AppModule"
```

---

## Task 4: End-to-end tests

**Files:**

- Create: `test/categories.e2e-spec.ts`

**Interfaces:**

- Consumes: Phase 1 API-versioning and role migration; running `AppModule`; `configureApp()`; `POST /api/v1/auth/login`; seeded MASTER_ADMIN account using `MASTER_ADMIN_BOOTSTRAP_EMAIL` / `MASTER_ADMIN_BOOTSTRAP_PASSWORD`.
- Produces: nothing — no later task depends on this one

- [ ] **Step 1: Seed the database with a MASTER_ADMIN account**

Run: `npm run db:seed`
Expected: an active, verified MASTER_ADMIN user exists and can log in.

- [ ] **Step 2: Write the failing e2e test file**

```ts
// test/categories.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';

describe('Categories (e2e)', () => {
  let app: INestApplication;
  let masterAdminAccessToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.MASTER_ADMIN_BOOTSTRAP_EMAIL,
        password: process.env.MASTER_ADMIN_BOOTSTRAP_PASSWORD,
      })
      .expect(200);

    masterAdminAccessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /categories without a Bearer token returns 401', async () => {
    await request(app.getHttpServer()).post('/categories').send({ name: 'Shoes' }).expect(401);
  });

  it('POST /api/v1/categories as MASTER_ADMIN creates a category and returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ name: `Shoes ${Date.now()}` })
      .expect(201);

    expect(res.body).toMatchObject({ name: expect.stringContaining('Shoes') });
    expect(res.body.slug).toBeDefined();
  });

  it('POST /categories with a missing name returns 400', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({})
      .expect(400);
  });

  it('POST /categories with a duplicate name returns 409', async () => {
    const name = `Duplicate ${Date.now()}`;
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ name })
      .expect(201);
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ name })
      .expect(409);
  });

  it('GET /categories returns a paginated envelope', async () => {
    const res = await request(app.getHttpServer()).get('/categories').expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta.page');
    expect(res.body).toHaveProperty('meta.limit');
    expect(res.body).toHaveProperty('meta.total');
  });

  it('GET /categories/:id returns 404 when not found', async () => {
    await request(app.getHttpServer()).get('/categories/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('GET /categories/:id returns 400 when id is not a UUID', async () => {
    await request(app.getHttpServer()).get('/categories/not-a-uuid').expect(400);
  });

  it('DELETE /categories/:id without a Bearer token returns 401', async () => {
    await request(app.getHttpServer()).delete('/categories/00000000-0000-0000-0000-000000000000').expect(401);
  });
});
```

- [ ] **Step 3: Run the e2e suite to verify it fails**

Run: `npm run test:e2e -- test/categories.e2e-spec.ts`
Expected: FAIL if Task 3 wasn't completed yet (module not registered). If Task 3 is done, most assertions should already pass since this exercises real running code — run it now to confirm no environment issues before treating it as "green."

- [ ] **Step 4: Fix any environment issues surfaced**

- Login returns 401 → re-run `npm run db:seed` and confirm `.env` has `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD` matching a seeded row.
- Tests hang or time out → confirm `DATABASE_URL` in `.env` points to a Postgres instance reachable from the test process.
- `403` where `201` expected → confirm the seeded user actually has the `ADMIN` role assigned in `user_roles` (not just `status: ACTIVE`).

- [ ] **Step 5: Run the full e2e suite to verify it passes**

Run: `npm run test:e2e`
Expected: PASS (all suites, including `categories.e2e-spec.ts` — 8 tests)

- [ ] **Step 6: Run the full unit suite as a regression check**

Run: `npm run test`
Expected: PASS (all suites)

- [ ] **Step 7: Lint, format, build**

Run: `npm run lint && npm run format && npm run build`
Expected: all three exit 0, no errors

- [ ] **Step 8: Commit**

```bash
git add test/categories.e2e-spec.ts
git commit -m "test(categories): add e2e coverage for auth guard, validation, conflict, and not-found paths"
```

---

## Task 5: Swagger + Postman sync

**Files:** none (Swagger decorators already added in Task 3) — this task verifies the OpenAPI doc and mirrors it to Postman.

**Interfaces:**

- Consumes: running app from Task 3/4
- Produces: nothing — final wrap-up before PR

- [ ] **Step 1: Start the app and check Swagger UI**

Run: `npm run start:dev`
Open: `http://localhost:3000/api`
Expected: `categories` tag shows all 5 routes with request/response shapes matching the DTOs from Task 1.

- [ ] **Step 2: Sync the Postman collection**

Requires `POSTMAN_API_KEY` and `POSTMAN_COLLECTION_ID` set in `.env` (see `.env.example`).

Run: `npm run postman:sync`
Expected: exits 0; Postman collection now includes the 5 `categories` routes.

- [ ] **Step 3: Stop the dev server, run the final full check**

Run: `npm run lint && npm run test && npm run test:e2e && npm run build`
Expected: all pass

- [ ] **Step 4: Confirm no stray file changes**

Run: `git status`
Expected: clean — `postman:sync` writes to Postman's API directly, not to local files. If something is dirty, review it before committing.

---

## Self-Review Notes

- **Spec coverage:** every decision from `doc/categories-module-plan.md` §2 (Q3, Q5/ADR 0001, Q6, Q8, Q9, Q10, Q7/Q11, English runtime messages) maps to a concrete step above — see Global Constraints for the one-line form of each, and Task 2/3 for where each is implemented.
- **Type consistency:** `CreateCategoryDto`, `UpdateCategoryDto`, `PaginationDto`, `CategoryResponseDto`, and the 5 `CategoriesService` method signatures are named identically everywhere they're referenced across Tasks 1–4.
- **No placeholders:** every step above contains complete, copy-pasteable code or an exact shell command — nothing marked TBD/"add validation"/"similar to Task N".
