# Categories Module — Implementation Plan

> Nguồn: buổi `/grill-with-docs` ngày 2026-09-17, dựa trên `ecommerce-postgresql-database-summary.md` + quyết định chốt trong session (Q1–Q11) + `adr/0001-category-delete-restrict.md`.
> Convention chi tiết (DTO/service/controller/test mẫu) đã có sẵn ở `../docs/convention` mục B — file này chỉ là **checklist thực thi theo thứ tự**, không lặp lại code mẫu.

---

## 1. Vì sao Categories trước

Theo `ecommerce-postgresql-database-summary.md` mục 7, luồng nghiệp vụ là `Catalog → Cart → Checkout`. `products.category_id → categories.id` là FK bắt buộc, nên `categories` phải tồn tại và có API thật trước khi làm `products`. Auth đã xong (`JwtAuthGuard`/`RolesGuard`/`OwnershipGuard`) — Categories là module non-Auth đầu tiên, tái sử dụng nguyên guard đó.

## 2. Quyết định đã chốt (tham chiếu nhanh)

| #      | Chủ đề                   | Quyết định                                                                                                                                            |
| ------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q3     | Authorization            | `GET` public; writes → `JwtAuthGuard` + `RolesGuard` accepting `STORE_MANAGER` or `MASTER_ADMIN` (ADR 0005)                                           |
| Q5     | Xoá category còn product | Không cascade, không set NULL — chặn (409 kèm số lượng), store manager phải reassign trước ([ADR 0001](../docs/adr/0001-category-delete-restrict.md)) |
| Q6     | Slug                     | Server tự sinh từ `name` bằng `slugify` (`locale: 'vi'`), client không gửi `slug`                                                                     |
| Q8     | Trùng slug               | 409 rõ ràng, KHÔNG tự thêm hậu tố số                                                                                                                  |
| Q9     | Đổi `name` (PATCH)       | Sinh lại `slug` theo tên mới (chấp nhận link cũ 404 ở MVP)                                                                                            |
| Q10    | `description`            | Optional                                                                                                                                              |
| Q7/Q11 | Pagination               | Áp dụng ngay từ đầu (kể cả `Category` ít bản ghi), response bọc `{ data, meta }`                                                                      |
| —      | Runtime message          | Tiếng Anh (message ném ra client); comment giải thích trong code — tiếng Việt                                                                         |

Model `Category` **đã có sẵn** trong `prisma/schema/schema.prisma` và **đã migrate** (`20260911030156_init_ecommerce`) — không cần migration mới cho module này.

## 3. Progress Snapshot

> Cập nhật phần này khi code tiến triển — phần còn lại của file là kế hoạch, không đổi theo tiến độ.

**Tình trạng hiện tại: 8/8 step đã xong.** Module `src/categories/` đã có đủ DTO, service, controller, module wiring vào `AppModule`, unit test (`categories.service.spec.ts`) và e2e test (`test/categories.e2e-spec.ts`); `npm run lint`/`npm run build` chạy sạch.

Chú giải: 🔴 Chưa làm · 🟡 Đang làm / scaffold rỗng · 🟢 Đã xong.

---

## 4. Implementation Steps

### STEP 1 — Cài dependency `slugify` — 🟢

**CLI:**

```bash
npm install slugify
```

**Acceptance Criteria:**

- [x] `package.json` có `slugify` trong `dependencies`.

---

### STEP 2 — Scaffold module — 🟢

**Goal:** Khung thư mục đúng convention `../docs/convention` §3.

**CLI:**

```bash
nest g resource categories
```

Trả lời CLI prompt: transport = **REST API**, và **"Would you like to generate CRUD entry points?" → Yes** (chọn `No` sẽ sinh module/controller/service rỗng, không có sẵn 5 method `create/findAll/findOne/update/remove` mà các bước sau giả định đã tồn tại).

**Chỉnh tay sau khi CLI sinh xong:**

- [x] Xoá `src/categories/entities/`.
- [x] Xoá `*.spec.ts` rỗng do CLI sinh (viết lại đúng ở STEP 7).
- [x] Sửa mọi import nội bộ thêm đuôi `.js` (ESM).
- [x] Thêm `src/categories/dto/pagination.dto.ts` (dùng chung shape `{ page, limit }`).
- [x] Kiểm tra `src/categories/categories.module.ts` do CLI sinh khớp đúng shape sau (không cần chỉnh nếu CLI đã tự wiring đúng):

  ```ts
  // src/categories/categories.module.ts
  import { Module } from '@nestjs/common';
  import { CategoriesService } from './categories.service.js';
  import { CategoriesController } from './categories.controller.js';

  @Module({
    controllers: [CategoriesController],
    providers: [CategoriesService],
  })
  export class CategoriesModule {}
  ```

  > Không cần import `PrismaModule` ở đây — `src/prisma/prisma.module.ts` đã đánh dấu `@Global()`, `PrismaService` tự inject được ở mọi module không cần khai `imports`.

**Acceptance Criteria:**

- [x] `npm run build` không lỗi (dù logic bên trong còn rỗng).
- [x] `CategoriesModule` đã được `nest g resource` tự thêm vào `AppModule.imports`.

---

### STEP 3 — DTO — 🟢

**Files:** `src/categories/dto/create-category.dto.ts`, `update-category.dto.ts`, `pagination.dto.ts`

**Implementation** (khung chung xem `../docs/convention` §4, §13 — dưới đây là code cụ thể cho `Category`):

```ts
// create-category.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ maxLength: 150 })
  // Trim trước khi validate — tên chỉ gồm khoảng trắng phải bị @IsNotEmpty()
  // từ chối thay vì lọt qua rồi sinh slug rỗng (xem CategoriesService.toSlug()).
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  name: string;

  // Không có field `slug` — server tự sinh từ `name` (xem STEP 4). Client gửi
  // `slug` trong body sẽ bị ValidationPipe global (`forbidNonWhitelisted`)
  // từ chối với 400, không bị âm thầm bỏ qua.

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

> Import `PartialType` từ **`@nestjs/swagger`**, không phải `@nestjs/mapped-types` — xem lý do ở `../docs/convention` §4.

- [x] `CreateCategoryDto`: `name` (bắt buộc, `@IsString @MaxLength(150)`), `description` (optional). **Không có field `slug`.**
- [x] `UpdateCategoryDto extends PartialType(CreateCategoryDto)`.
- [x] `PaginationDto`: `page` (default 1), `limit` (default 20, `@Max(100)`) — dùng nguyên code mẫu ở `../docs/convention` §13, không cần đổi gì cho `Category`.

**Acceptance Criteria:**

- [x] Gửi `{ slug: 'x', name: 'A' }` qua `ValidationPipe` global (`forbidNonWhitelisted`) → 400 (field lạ bị chặn).
- [x] Thiếu `name` → 400.

---

### STEP 4 — Service — 🟢

**Files:** `src/categories/categories.service.ts`

**Implementation** (khung chung + lưu ý pre-fetch/race-condition xem `../docs/convention` §5 — dưới đây là code cụ thể cho `Category`):

```ts
// categories.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import type { Category } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const slug = this.toSlug(createCategoryDto.name);

    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) {
      // Q8: trùng slug (thường do trùng tên) → 409 rõ ràng, KHÔNG tự thêm hậu
      // tố (vd. `ao-2`) — trùng tên category thật ra hiếm khi là ý muốn thật.
      throw new ConflictException(`Category name "${createCategoryDto.name}" already exists`);
    }

    return this.prisma.category.create({ data: { ...createCategoryDto, slug } });
  }

  // Q7: pagination áp dụng ngay từ đầu cho mọi resource (kể cả Category, dù
  // ít bản ghi) để giữ response shape nhất quán — xem PaginationDto ở STEP 3.
  async findAll({ page, limit }: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        skip: (page - 1) * limit,
        take: limit,
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

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    // Pre-fetch cần thiết ở đây (khác remove() bên dưới): phải biết category
    // có tồn tại hay không TRƯỚC khi check trùng slug, để đổi tên 1 id không
    // tồn tại trả đúng 404 thay vì rơi nhầm xuống nhánh 409 (trùng tên).
    await this.findOne(id);

    // Q9: đổi `name` → sinh lại `slug` theo tên mới (chấp nhận link cũ 404 ở
    // MVP này — chưa có cơ chế redirect slug cũ).
    const data: UpdateCategoryDto & { slug?: string } = { ...updateCategoryDto };
    if (updateCategoryDto.name) {
      const slug = this.toSlug(updateCategoryDto.name);
      const existing = await this.prisma.category.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Category name "${updateCategoryDto.name}" already exists`);
      }
      data.slug = slug;
    }

    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    // Không pre-fetch chỉ để xác nhận tồn tại — nếu id không tồn tại,
    // prisma.category.delete() bên dưới tự ném P2025, đã được
    // AllExceptionsFilter map sẵn thành 404 (khác update() ở trên, vì ở đây
    // không có nhánh 409 nào khác cần xác định thứ tự lỗi trước).
    const productCount = await this.prisma.product.count({ where: { categoryId: id } });

    // ADR 0001: FK `products.category_id → categories.id` là RESTRICT — thay
    // vì để lỗi P2003 rơi xuống Prisma filter (500/khó hiểu), tự kiểm tra
    // trước và trả 409 kèm số lượng, để store manager biết chính xác phải làm gì
    // (chuyển product sang category khác trước khi xoá được).
    if (productCount > 0) {
      throw new ConflictException(`Category still has ${productCount} product(s) — reassign them before deleting`);
    }

    await this.prisma.category.delete({ where: { id } });
  }

  private toSlug(name: string): string {
    const slug = slugify(name, { lower: true, locale: 'vi', strict: true });
    // Tên chỉ gồm ký tự đặc biệt/dấu câu (vd. "!!!") vẫn qua được @IsNotEmpty()
    // (đã trim ở DTO) nhưng slugify trả về "" — nếu cho lọt qua, category đầu
    // tiên kiểu này sẽ có slug rỗng và mọi tên "vô nghĩa" sau đó sẽ bị báo
    // trùng tên (409) dù nhìn không giống nhau chút nào.
    if (!slug) {
      throw new BadRequestException(`Category name "${name}" does not produce a valid slug`);
    }
    return slug;
  }
}
```

> `locale: 'vi'` giúp `slugify` xử lý đúng dấu tiếng Việt (VD: `"Áo Nam"` → `ao-nam` thay vì bỏ sót/giữ nguyên ký tự có dấu). `strict: true` loại bỏ mọi ký tự không phải chữ/số/dấu gạch ngang khỏi slug. CLI: `npm install slugify`.
>
> ⚠️ Pre-check unique/FK ở trên vẫn có race condition (2 request gần như đồng thời) — xem giải thích đầy đủ ở `../docs/convention` §5 ("Pre-check không thay thế unique constraint ở DB"). Unique constraint trên `slug` + FK `RESTRICT` trên `products.category_id` ở DB mới là lớp bảo vệ cuối cùng.

- [x] `create()`: sinh slug, check trùng → 409 (`Category name "..." already exists`) nếu trùng, không tự thêm hậu tố.
- [x] `findAll(pagination)`: `skip/take` + `orderBy` tie-breaker → trả `{ data, meta }`.
- [x] `findOne(id)`: 404 nếu không tồn tại.
- [x] `update(id, dto)`: nếu đổi `name` → sinh lại slug, check trùng (loại trừ chính record đang sửa).
- [x] `remove(id)`: đếm `prisma.product.count({ where: { categoryId: id } })` → 409 (`Category still has N product(s)...`) nếu > 0, ngược lại `delete`.

**Acceptance Criteria:**

- [x] Tạo 2 category cùng tên → lần 2 nhận 409.
- [x] Sửa `name` → `slug` đổi theo.
- [x] Xoá category không có product → thành công.
- [x] Xoá category còn product → 409, không đụng tới DB (product không bị xoá/không đổi).

---

### STEP 5 — Controller — 🟢

**Files:** `src/categories/categories.controller.ts`

**Implementation** (theo `../docs/convention` §6):

- [x] `GET /api/v1/categories`, `GET /api/v1/categories/:id` — public, không guard, `ParseUUIDPipe` cho `:id`.
- [x] `POST /api/v1/categories`, `PATCH /api/v1/categories/:id`, `DELETE /api/v1/categories/:id` — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('STORE_MANAGER', 'MASTER_ADMIN')` + `@ApiBearerAuth()`.
- [x] `DELETE` trả `204 No Content`.

**Acceptance Criteria:**

- [x] Gọi `POST /api/v1/categories` không kèm Bearer token → 401.
- [x] Gọi `POST /api/v1/categories` với token user role `CUSTOMER` → 403.
- [x] Gọi `POST /api/v1/categories` với token STORE_MANAGER hoặc MASTER_ADMIN → 201.

---

### STEP 6 — Swagger — 🟢

**Implementation** (theo `../docs/convention` §12):

- [x] `@ApiTags('categories')` ở controller.
- [x] `@ApiOkResponse`/`@ApiCreatedResponse`/`@ApiNoContentResponse` có `type:` (dùng thẳng Prisma `Category` type — không cần Response DTO riêng vì không có field nhạy cảm, theo §11.a).
- [x] Sau khi xong, chạy `npm run postman:sync` để đồng bộ Postman collection.

**Acceptance Criteria:**

- [x] `http://localhost:3000/api` hiển thị đủ 5 route với đúng request/response shape.

---

### STEP 7 — Testing — 🟢

**Files:** `src/categories/categories.service.spec.ts`, `test/categories.e2e-spec.ts`

**Implementation** (theo `../docs/convention` §8 — code mẫu đầy đủ):

- [x] Unit test service (mock `PrismaService`): `create` sinh đúng slug + gọi `prisma.category.create`; `create` ném `ConflictException` khi trùng tên; `findOne` ném `NotFoundException`; `remove` ném `ConflictException` khi còn product.
- [x] e2e test (`supertest`, dùng `configureApp()` chung với `main.ts`): 401 khi thiếu token, 201 khi MASTER_ADMIN tạo thành công, 400 khi thiếu `name`, 409 khi trùng tên, 404 khi `GET /categories/:id` không tồn tại, 400 khi `:id` không phải UUID.
- [x] e2e cần `masterAdminAccessToken` — lấy bằng cách gọi thật `POST /api/v1/auth/login` trong `beforeAll`, **sau khi Phase 1 đã migrate seed/config** sang `MASTER_ADMIN_BOOTSTRAP_EMAIL`/`MASTER_ADMIN_BOOTSTRAP_PASSWORD`:

  ```ts
  // test/categories.e2e-spec.ts — trong beforeAll, sau khi app.init()
  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({
      email: process.env.MASTER_ADMIN_BOOTSTRAP_EMAIL,
      password: process.env.MASTER_ADMIN_BOOTSTRAP_PASSWORD,
    })
    .expect(200);

  masterAdminAccessToken = loginRes.body.accessToken; // LoginResponseDto = { accessToken, user }
  ```

  > `POST /api/v1/auth/login` nhận `LoginDto = { email: string, password: string }` (`src/auth/dto/login.dto.ts`), trả `LoginResponseDto = { accessToken, user }` (`src/auth/dto/login-response.dto.ts`) — refresh token được set qua HttpOnly cookie, không nằm trong response body, không cần dùng tới cho test Categories.

**Acceptance Criteria:**

- [x] `npm run test` pass.
- [x] `npm run test:e2e` pass.

---

### STEP 8 — Lint / Build / PR — 🟢

**CLI:**

```bash
npm run lint
npm run format
npm run build
```

**Acceptance Criteria:**

- [x] Cả 3 lệnh trên chạy sạch, không lỗi.
- [x] Đối chiếu lại [Definition of Done](../docs/convention/api-conventions.md#definition-of-done) trước khi mở PR (dùng `ship-pr` skill).

---

## 5. Gap đã biết (không block Categories, nhưng cần nhớ)

| Gap                                                           | Mức độ                      | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Race window giữa pre-check và write (không phải thiếu filter) | Đã giảm nhẹ — không còn 500 | Service đã tự pre-check (409 rõ ràng cho trùng tên / còn product), nhưng pre-check vẫn có race window đã ghi nhận ở `../docs/convention` §5 — 2 request tạo trùng tên gần như đồng thời có thể rớt xuống Prisma `P2002` ở tầng DB. `src/common/filters/all-exceptions.filter.ts` (`AllExceptionsFilter.resolvePrismaError()`) đã map sẵn `P2002`→409, `P2003`→409, `P2025`→404 (global, áp dụng cho mọi module) nên trong race window đó client vẫn nhận **409** thật qua filter này, không phải 500 — không cần viết thêm `PrismaExceptionFilter` riêng cho lý do này. |
| ~~Chưa có `src/bootstrap/configure-app.ts`~~                  | **Đã xong**                 | File đã tồn tại và đã wiring vào `main.ts` (`configureApp(app)`) — STEP 7 chỉ cần _dùng lại_, không cần tạo mới. (Gap này từng đúng lúc viết `../docs/convention`, đã lỗi thời — nếu thấy dòng tương tự ở `../docs/convention` §8, đó cũng là thông tin cũ.)                                                                                                                                                                                                                                                                                                            |

## 6. Sau khi Categories xong

Chuyển sang `ProductsModule` (products + product_variants + product_images + inventory) — theo đúng thứ tự đã chốt ở round grilling trước, vì `products.category_id` cần `categories` tồn tại thật để test không phải mock.
