# Plan: Todo List API — Học NestJS cơ bản

> Xem `../CONTEXT.md` để biết định nghĩa domain (`Todo`, `Todo list`).
> File này liệt kê **các câu lệnh CLI** theo từng bước để tự tay chạy — không có bước nào tôi chạy hộ.

## Tóm tắt quyết định (từ phiên grilling)

- **Scope**: Module, Controller, Service, DI, DTO + validation, CRUD cơ bản, Swagger docs. Không auth, không test.
- **Domain**: `Todo` là 1 task đơn, nằm trong 1 collection phẳng — không có khái niệm List/Project.
- **Persistence**: in-memory (mảng trong Service), không DB/ORM.
- **Package manager**: npm.
- **Môi trường đã kiểm tra**: Node v22.21.1, npm 10.9.4.
- **Lưu ý quan trọng**: bản `@nestjs/cli` mới nhất scaffold project theo **ESM** (`"type": "module"` trong `../package.json`) — mọi import nội bộ (relative import) phải có đuôi `.js` dù file gốc là `.ts`, ví dụ: `import { TodosService } from './todos.service.js';`. Test runner mặc định là **Vitest** (không phải Jest), linter là **oxlint** (không phải ESLint).

### Entity `Todo`

| Field | Type | Ghi chú |
|---|---|---|
| `id` | `number` | tự tăng, service tự quản lý counter |
| `title` | `string` | bắt buộc, 1–255 ký tự |
| `description` | `string` | optional |
| `isDone` | `boolean` | mặc định `false` |
| `createdAt` | `Date` | gán lúc tạo |
| `updatedAt` | `Date` | gán lại mỗi lần `PATCH` |

### DTO

- `CreateTodoDto`: `title` (required), `description` (optional). Không cho set `isDone`/timestamps.
- `UpdateTodoDto extends PartialType(CreateTodoDto)` + `isDone` (optional).

### API

| Method | Path | Status thành công | Lỗi |
|---|---|---|---|
| GET | `/todos` | 200 | – |
| GET | `/todos/:id` | 200 | 404 nếu không tồn tại |
| POST | `/todos` | 201 | 400 nếu validation fail |
| PATCH | `/todos/:id` | 200 | 404 nếu không tồn tại |
| DELETE | `/todos/:id` | 204 | 404 nếu không tồn tại |

---

## Các bước thực hiện (CLI trước, code sau)

### Bước 1 — Cài `@nestjs/cli` và tạo project

Chạy trong `D:\my-doc\project\nestjs-demo`:

```bash
npx @nestjs/cli new . --package-manager npm
```

- Thư mục hiện có sẵn `../.idea`, `CONTEXT.md`, `PLAN.md` (không rỗng) → CLI sẽ hỏi kiểu *"? ... directory is not empty. Continue?"* → chọn **Yes**.
- **Không** dùng flag `--skip-git` — để CLI tự chạy `git init` **và** tự sinh `../.gitignore` chuẩn (2 việc này đi cùng nhau trong schematic của bản CLI hiện tại; nếu bỏ qua git thì `.gitignore` cũng bị bỏ qua theo).
- Package manager chọn **npm** (đã truyền sẵn qua flag).

**Nếu `npm install` báo lỗi** dạng `Cannot read properties of null (reading 'edgesOut')` (bug đã gặp của npm 10.9.4 khi resolve peer deps của `vitest`):

```bash
npm install --legacy-peer-deps
```

(hoặc nâng cấp npm: `npm install -g npm@latest` rồi thử lại `npm install` bình thường).

Kết quả sau bước này: `../src/app.controller.ts`, `src/app.service.ts`, `src/app.module.ts`, `src/main.ts`, `package.json`, `.gitignore`, repo git đã init.

### Bước 2 — Generate resource `todos` bằng CLI

```bash
npx nest g resource todos --no-spec
```

> Dùng `npx nest ...` vì `nest` CLI chỉ được cài local (trong `node_modules`) ở Bước 1, chưa cài global. Nếu muốn gõ `nest` trực tiếp không cần `npx`, cài global 1 lần: `npm install -g @nestjs/cli`.

- CLI hỏi transport layer → chọn **REST API**.
- CLI hỏi "Would you like to generate CRUD entry points?" → chọn **Yes**.
- `--no-spec`: bỏ qua sinh file test (`.spec.ts`) vì scope đã chốt không viết test.

Kết quả sinh ra:
```
src/todos/
  dto/create-todo.dto.ts
  dto/update-todo.dto.ts
  entities/todo.entity.ts
  todos.controller.ts
  todos.service.ts
  todos.module.ts
```
`TodosModule` được tự động import vào `app.module.ts`.

### Bước 3 — Cài `class-validator` / `class-transformer`

```bash
npm install class-validator class-transformer
```

(Dùng `--legacy-peer-deps` thêm nếu vẫn gặp lỗi arborist như ở Bước 1.)

`@nestjs/mapped-types` (cần cho `PartialType` ở Bước 6) thường đã được CLI tự thêm sẵn khi generate resource; nếu chưa có trong `../package.json` thì cài thêm: `npm install @nestjs/mapped-types`.

### Bước 4 — Định nghĩa lại `Todo` entity

Sửa `src/todos/entities/todo.entity.ts`:

```ts
export class Todo {
  id: number;
  title: string;
  description?: string;
  isDone: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Bước 5 — Viết `CreateTodoDto`

Sửa `../src/todos/dto/create-todo.dto.ts`:

```ts
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTodoDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

### Bước 6 — Viết `UpdateTodoDto`

Sửa `../src/todos/dto/update-todo.dto.ts` (chú ý import có đuôi `.js` vì project là ESM):

```ts
import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTodoDto } from './create-todo.dto.js';

export class UpdateTodoDto extends PartialType(CreateTodoDto) {
  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}
```

### Bước 7 — Viết `TodosService` (in-memory storage)

Sửa `../src/todos/todos.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Todo } from './entities/todo.entity.js';
import { CreateTodoDto } from './dto/create-todo.dto.js';
import { UpdateTodoDto } from './dto/update-todo.dto.js';

@Injectable()
export class TodosService {
  private todos: Todo[] = [];
  private nextId = 1;

  create(createTodoDto: CreateTodoDto): Todo {
    const now = new Date();
    const todo: Todo = {
      id: this.nextId++,
      title: createTodoDto.title,
      description: createTodoDto.description,
      isDone: false,
      createdAt: now,
      updatedAt: now,
    };
    this.todos.push(todo);
    return todo;
  }

  findAll(): Todo[] {
    return this.todos;
  }

  findOne(id: number): Todo {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) {
      throw new NotFoundException(`Todo #${id} not found`);
    }
    return todo;
  }

  update(id: number, updateTodoDto: UpdateTodoDto): Todo {
    const todo = this.findOne(id);
    Object.assign(todo, updateTodoDto, { updatedAt: new Date() });
    return todo;
  }

  remove(id: number): void {
    const todo = this.findOne(id);
    this.todos = this.todos.filter((t) => t.id !== todo.id);
  }
}
```

### Bước 8 — Viết `TodosController`

Sửa `../src/todos/todos.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { TodosService } from './todos.service.js';
import { CreateTodoDto } from './dto/create-todo.dto.js';
import { UpdateTodoDto } from './dto/update-todo.dto.js';

@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Post()
  create(@Body() createTodoDto: CreateTodoDto) {
    return this.todosService.create(createTodoDto);
  }

  @Get()
  findAll() {
    return this.todosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.todosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateTodoDto: UpdateTodoDto) {
    return this.todosService.update(id, updateTodoDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    this.todosService.remove(id);
  }
}
```

> `ParseIntPipe` tự convert `:id` từ string sang number và trả `400` nếu không phải số hợp lệ.

### Bước 9 — Bật `ValidationPipe` toàn cục

Sửa `../src/main.ts` (giữ nguyên `await bootstrap();` ở cuối, đây là kiểu top-level await mà ESM cho phép):

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
```

### Bước 10 — Build & chạy thử

```bash
npm run build
npm run start:dev
```

Test nhanh bằng curl (mở terminal khác trong khi server đang chạy):

```bash
curl -X POST http://localhost:3000/todos -H "Content-Type: application/json" -d "{\"title\":\"Hoc NestJS\"}"
curl http://localhost:3000/todos
curl -X PATCH http://localhost:3000/todos/1 -H "Content-Type: application/json" -d "{\"isDone\":true}"
curl -i -X DELETE http://localhost:3000/todos/1
curl -i http://localhost:3000/todos/999   # kỳ vọng 404
curl -i -X POST http://localhost:3000/todos -H "Content-Type: application/json" -d "{}"   # kỳ vọng 400 (thiếu title)
curl -i -X POST http://localhost:3000/todos -H "Content-Type: application/json" -d "{\"title\":\"x\",\"extra\":\"y\"}"   # kỳ vọng 400 (whitelist chặn field lạ)
```

### Bước 11 — Commit

```bash
git add -A
git commit -m "chore: initial NestJS scaffold"
```

(Không cần `git init` riêng vì đã được tạo tự động ở Bước 1.)

### Bước 12 — Thêm Swagger (OpenAPI docs)

Cài package:

```bash
npm install @nestjs/swagger
```

(Dùng `--legacy-peer-deps` thêm nếu vẫn gặp lỗi arborist như ở Bước 1.)

Sửa `../src/main.ts` để khởi tạo `SwaggerModule` sau khi tạo `app` (giữ nguyên `ValidationPipe` đã thêm ở Bước 9):

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Todo List API')
    .setDescription('API học NestJS cơ bản — CRUD Todo, in-memory storage')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
```

Gắn `@ApiProperty()` cho các field trong DTO để Swagger hiển thị đúng schema (không bắt buộc để chạy được, nhưng nên có để docs đầy đủ). Sửa `../src/todos/dto/create-todo.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTodoDto {
  @ApiProperty({ maxLength: 255, example: 'Học NestJS cơ bản' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'Module, Controller, Service, DI, DTO' })
  @IsOptional()
  @IsString()
  description?: string;
}
```

Vì `UpdateTodoDto` dùng `PartialType`, đổi import `PartialType` sang bản của `@nestjs/swagger` (nó vẫn tương thích với `class-validator`, đồng thời tự kế thừa metadata Swagger từ `CreateTodoDto`) — sửa `../src/todos/dto/update-todo.dto.ts`:

```ts
import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTodoDto } from './create-todo.dto.js';

export class UpdateTodoDto extends PartialType(CreateTodoDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}
```

> Có thể bỏ `npm install @nestjs/mapped-types` khỏi flow nếu không còn chỗ nào khác dùng nó, vì `@nestjs/swagger` cũng export `PartialType`.

Tạo thêm DTO riêng cho **response** (Swagger cần 1 class runtime để đọc schema — không dùng trực tiếp được entity `Todo` sau này khi entity đó chỉ còn là type Prisma, xem ghi chú ở Bước 21). Tạo file `../src/todos/dto/todo-response.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TodoResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Học NestJS cơ bản' })
  title: string;

  @ApiPropertyOptional({ example: 'Module, Controller, Service, DI, DTO' })
  description?: string;

  @ApiProperty({ example: false })
  isDone: boolean;

  @ApiProperty({ example: '2026-09-09T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-09T10:00:00.000Z' })
  updatedAt: Date;
}
```

> `TodoResponseDto` chỉ dùng làm metadata cho Swagger (khai báo schema + example ở response), controller **không** cần map thủ công sang class này — field trùng tên/kiểu với `Todo` (in-memory lẫn Prisma) nên trả thẳng object thật, NestJS/Swagger chỉ dùng class này để sinh doc.

Sửa lại `../src/todos/todos.controller.ts` (ghi đè bản ở Bước 8), thêm `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiParam`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TodosService } from './todos.service.js';
import { CreateTodoDto } from './dto/create-todo.dto.js';
import { UpdateTodoDto } from './dto/update-todo.dto.js';
import { TodoResponseDto } from './dto/todo-response.dto.js';

@ApiTags('todos')
@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo todo mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công', type: TodoResponseDto })
  @ApiResponse({ status: 400, description: 'Validation fail (thiếu title, sai kiểu, hoặc thừa field)' })
  create(@Body() createTodoDto: CreateTodoDto) {
    return this.todosService.create(createTodoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách toàn bộ todo' })
  @ApiResponse({ status: 200, description: 'Thành công', type: TodoResponseDto, isArray: true })
  findAll() {
    return this.todosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy 1 todo theo id' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Thành công', type: TodoResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy todo' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.todosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật 1 phần todo theo id' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công', type: TodoResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy todo' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateTodoDto: UpdateTodoDto) {
    return this.todosService.update(id, updateTodoDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá 1 todo theo id' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 204, description: 'Xoá thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy todo' })
  remove(@Param('id', ParseIntPipe) id: number) {
    this.todosService.remove(id);
  }
}
```

Build & chạy lại, sau đó mở trình duyệt:

```bash
npm run build
npm run start:dev
```

```
http://localhost:3000/api
```

→ kỳ vọng thấy Swagger UI:
- Nhóm 5 endpoint dưới tag **todos** (`GET /todos`, `GET /todos/:id`, `POST /todos`, `PATCH /todos/:id`, `DELETE /todos/:id`), mỗi endpoint có mô tả ngắn (summary) và liệt kê đủ các status code có thể trả về (200/201/204/400/404).
- Request body (`POST`/`PATCH`) hiển thị sẵn giá trị mẫu (nhờ `example` trong DTO) khi bấm "Try it out".
- Response schema hiển thị đủ field của `Todo` (`id`, `title`, `description`, `isDone`, `createdAt`, `updatedAt`) kèm giá trị mẫu, nhờ `TodoResponseDto`.

### Bước 13 — Commit

```bash
git add -A
git commit -m "feat: add Swagger docs"
```

---

## Phần mở rộng: thay in-memory bằng PostgreSQL (Prisma)

> Quyết định: dùng **Prisma** làm ORM, PostgreSQL server đã cài sẵn trên máy local (không dùng Docker). Toàn bộ bước dưới đây là CLI/thao tác thủ công — tự chạy, không có bước nào assistant chạy hộ.

### Bước 14 — Tạo database trong PostgreSQL local

Mở `psql` (hoặc pgAdmin/DBeaver — công cụ nào bạn quen) và tạo 1 database riêng cho project:

```sql
CREATE DATABASE nestjs_demo;
```

Ghi lại thông tin kết nối bạn đang có sẵn trên máy: **host** (thường `localhost`), **port** (thường `5432`), **user**, **password**, **tên database** (`nestjs_demo`).

> ⚠️ **Lưu ý bản Prisma đang dùng (v7)**: `prisma@7.10.0` (bản ổn định hiện tại, đã ghim ở phần audit) thay đổi khá nhiều so với v6 mà các bản hướng dẫn Prisma cũ trên mạng hay dùng: connection URL không còn khai báo trong `schema.prisma` nữa mà chuyển sang `prisma.config.ts`, và **bắt buộc phải cài driver adapter** (`@prisma/adapter-pg` + `pg`) để `PrismaClient` chạy được — không thể `new PrismaClient()` suông như trước. Các bước dưới đây đã viết đúng theo v7.

### Bước 15 — Cài Prisma

```bash
npm install --save-dev prisma
npm install @prisma/client
npm install @prisma/adapter-pg pg
npm install dotenv
```

(Dùng `--legacy-peer-deps` thêm nếu vẫn gặp lỗi arborist như ở Bước 1.)

### Bước 16 — Khởi tạo Prisma

```bash
npx prisma init --datasource-provider postgresql
```

Lệnh này tạo:
- `../prisma/schema.prisma` — file khai báo schema.
- `prisma.config.ts` (hoặc `../prisma7.config.ts` tuỳ bản CLI) — nơi khai báo connection URL thật cho Migrate/Studio (thay cho `datasource.url` trong `schema.prisma` như v6).
- `../.env` — chứa biến `DATABASE_URL` (đã nằm sẵn trong `.gitignore`, không commit).

Sửa `../.env`, thay giá trị mẫu bằng thông tin thật ở Bước 14:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/nestjs_demo?schema=public"
```

Mở file `prisma.config.ts`/`../prisma7.config.ts` vừa tạo, xác nhận nó có dạng sau (CLI thường tự sinh sẵn, không cần sửa gì thêm):

```ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
```

### Bước 17 — Định nghĩa model `Todo` trong `schema.prisma`

Sửa `../prisma/schema.prisma`, thêm model tương ứng entity đang có ở Bước 4:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model Todo {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(255)
  description String?
  isDone      Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

> Lưu ý 2 điểm khác v6:
> - `generator client` dùng `provider = "prisma-client"` (không phải `"prisma-client-js"`) và **bắt buộc** có `output` — Prisma Client được generate ra thẳng thư mục `../src/generated/prisma` (code thật, không phải cache trong `node_modules`), import trực tiếp từ đó thay vì từ package `@prisma/client`.
> - `datasource db` **không có dòng `url`** — connection URL đã chuyển sang `prisma.config.ts` ở Bước 16. Nếu để `url = env("DATABASE_URL")` ở đây, `prisma migrate dev` sẽ báo lỗi `P1012: The datasource property url is no longer supported in schema files`.
> - `@updatedAt` để Prisma tự gán lại `updatedAt` mỗi lần record được update — không cần tự set tay trong code như bản in-memory.

Vì thư mục `../src/generated/prisma` là code tự sinh, thêm dòng sau vào `.gitignore` (không commit):

```
src/generated
```

### Bước 18 — Chạy migration

```bash
npx prisma migrate dev --name init
```

- Lệnh này tạo bảng `Todo` thật trong database `nestjs_demo`, đồng thời tự generate Prisma Client vào `../src/generated/prisma` khớp với schema.
- Nếu sau này sửa `schema.prisma` thì chạy lại đúng lệnh này với `--name` mô tả thay đổi (ví dụ `--name add-priority-field`).

### Bước 19 — Cài `@nestjs/config` để load `../.env` khi chạy app

`prisma.config.ts` tự đọc `../.env` cho Prisma CLI (migrate/studio), nhưng lúc NestJS chạy runtime (`npm run start:dev`) thì cần chủ động load biến môi trường vào `process.env` trước khi `PrismaClient` khởi tạo (vì `PrismaService` ở Bước 20 đọc `process.env.DATABASE_URL` để truyền vào driver adapter):

```bash
npm install @nestjs/config
```

Sửa `../src/app.module.ts`, thêm `ConfigModule` (đặt đầu danh sách `imports`):

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TodosModule } from './todos/todos.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TodosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### Bước 20 — Tạo `PrismaService` (kèm driver adapter)

Kiểm tra lại đã có đủ 3 thứ sau chưa trước khi viết code (nếu ở Bước 15 bạn cài thiếu, hoặc schema đổi sau đó, generate cũ không còn khớp — cứ chạy lại cho chắc, không hại gì):

```bash
npm install @prisma/client @prisma/adapter-pg pg
npx prisma generate
```

- `npm install ...`: đảm bảo có `@prisma/client` (runtime nền mà `prisma-client` generator dựa vào), `@prisma/adapter-pg` + `pg` (driver adapter — package npm thật, nằm trong `node_modules`).
- `npx prisma generate`: đọc `schema.prisma` (đã sửa ở Bước 17) rồi **sinh code thật** vào `../src/generated/prisma` — đây là lý do `import ... from '../generated/prisma/client.js'` ở dưới trỏ được, vì file đó do lệnh này tạo ra chứ không phải cài qua `npm install`. Nếu thư mục `src/generated/prisma` chưa tồn tại hoặc báo lỗi khi import, nghĩa là bạn chưa chạy lệnh này (hoặc chạy lúc `schema.prisma` còn sai).

Dùng CLI để scaffold, nhất quán với cách làm ở Bước 2 (`nest g resource`):

```bash
npx nest g module prisma --no-spec
npx nest g service prisma --no-spec
```

- `nest g module prisma`: tạo `../prisma/prisma.module.ts` **và tự động import `PrismaModule` vào `src/app.module.ts`** (thêm vào mảng `imports`) — không cần tự tay sửa `app.module.ts` như trước.
- `nest g service prisma`: tạo `../src/prisma/prisma.service.ts` **và tự động đăng ký `PrismaService` vào `providers` của `prisma.module.ts`**.

Sau khi CLI sinh xong, sửa nội dung 2 file này lại như sau.

Sửa `../src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

> Khác v6: `PrismaClient` không còn tự kết nối DB bằng URL suông — phải truyền `adapter` (ở đây là `PrismaPg`, bọc quanh driver `pg`) vào constructor. Import `PrismaClient` cũng đổi từ package `@prisma/client` sang đường dẫn tương đối tới `output` đã khai báo ở Bước 17.

Sửa `../prisma/prisma.module.ts` — CLI chỉ sinh khung rỗng, cần tự thêm `@Global()` (để mọi module khác dùng được `PrismaService` mà không cần import lại `PrismaModule` từng nơi) và `exports`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

> `@Global()` và dòng `exports` là 2 chỗ CLI không tự thêm — bắt buộc phải tự sửa tay, nếu không `TodosService` ở Bước 22 sẽ không inject được `PrismaService`.

### Bước 21 — Bỏ entity `Todo` tự viết, dùng type Prisma sinh ra

Prisma Client tự sinh type `Todo` khớp với model trong `schema.prisma`, nằm trong thư mục generate ở Bước 17 (không phải package `@prisma/client` nữa). Xoá file `src/todos/entities/todo.entity.ts` (không cần nữa) — mọi chỗ đang `import { Todo } from './entities/todo.entity.js'` đổi sang:

```ts
import type { Todo } from '../generated/prisma/client.js';
```

### Bước 22 — Viết lại `TodosService` dùng `PrismaService` thay in-memory

Sửa `../src/todos/todos.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Todo } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTodoDto } from './dto/create-todo.dto.js';
import { UpdateTodoDto } from './dto/update-todo.dto.js';

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  create(createTodoDto: CreateTodoDto): Promise<Todo> {
    return this.prisma.todo.create({ data: createTodoDto });
  }

  findAll(): Promise<Todo[]> {
    return this.prisma.todo.findMany();
  }

  async findOne(id: number): Promise<Todo> {
    const todo = await this.prisma.todo.findUnique({ where: { id } });
    if (!todo) {
      throw new NotFoundException(`Todo #${id} not found`);
    }
    return todo;
  }

  async update(id: number, updateTodoDto: UpdateTodoDto): Promise<Todo> {
    await this.findOne(id); // ném 404 nếu không tồn tại
    return this.prisma.todo.update({ where: { id }, data: updateTodoDto });
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id); // ném 404 nếu không tồn tại
    await this.prisma.todo.delete({ where: { id } });
  }
}
```

> `TodosController` không cần sửa gì — vẫn gọi các method cùng tên, giờ chỉ trả về `Promise` thay vì giá trị đồng bộ (NestJS tự `await` khi trả về từ controller).

### Bước 23 — Build & test lại

```bash
npm run build
npm run start:dev
```

Chạy lại đúng bộ curl ở Bước 10 để xác nhận hành vi giống hệt bản in-memory (201/200/204/404/400), khác biệt duy nhất: **restart server xong, gọi `GET /todos` vẫn còn dữ liệu cũ** (vì giờ lưu thật trong PostgreSQL, không mất khi tắt app).

Kiểm tra nhanh bằng Prisma Studio (GUI xem data trong DB) nếu muốn:

```bash
npx prisma studio
```

### Bước 24 — Commit

```bash
git add -A
git commit -m "feat: replace in-memory storage with PostgreSQL via Prisma"
```

> Nhắc lại: `../.env` không được commit (đã nằm trong `.gitignore`). Nếu người khác clone project, họ cần tự tạo `.env` riêng với `DATABASE_URL` của máy họ, rồi chạy `npx prisma migrate dev` để tạo bảng.

### Bước 25 — Seed data mẫu

> ⚠️ Khác v6: Prisma v7 **không tự chạy seed kèm `migrate dev`/`migrate reset`** nữa — phải khai báo lệnh seed trong `prisma.config.ts` rồi tự gọi `prisma db seed` khi cần.

Cài `tsx` để chạy trực tiếp file `.ts` làm script seed (không cần build trước):

```bash
npm install --save-dev tsx
```

Tạo file `../prisma/seed.ts`:

```ts
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  await prisma.todo.createMany({
    data: [
      { title: 'Học NestJS cơ bản', description: 'Module, Controller, Service, DI, DTO', isDone: true },
      { title: 'Thêm Swagger', description: 'Viết OpenAPI docs cho API', isDone: true },
      { title: 'Kết nối PostgreSQL qua Prisma', isDone: true },
      { title: 'Viết unit test bằng Vitest' },
    ],
  });
}

main()
  .then(() => console.log('Seed thành công'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

> `import 'dotenv/config'` ở đầu file để nạp `../.env` — script này chạy độc lập qua `tsx`, không đi qua `ConfigModule` của NestJS như lúc `npm run start:dev`.

Sửa `../prisma7.config.ts` (hoặc `prisma.config.ts` tuỳ tên CLI đã tạo), thêm dòng `seed` vào `migrations`:

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

Chạy seed:

```bash
npx prisma db seed
```

> Lệnh này **cộng thêm** data mới mỗi lần chạy (dùng `createMany`) — chạy nhiều lần sẽ tạo trùng record. Nếu muốn seed chạy lại nhiều lần mà không bị trùng (idempotent), đổi `createMany` thành nhiều lệnh `upsert` (cần 1 field unique để làm điều kiện, ví dụ thêm `@unique` cho `title`, hoặc seed dựa theo `id` cố định).

Kiểm tra lại bằng `psql` hoặc `npx prisma studio`, hoặc gọi thẳng API:

```bash
curl http://localhost:3000/todos
```

### Bước 26 — Commit

```bash
git add -A
git commit -m "chore: add seed script for sample data"
```

---

## Sau khi hoàn thành (gợi ý bước tiếp theo, không nằm trong scope hiện tại)

- Thêm unit test (Vitest) cho `TodosService`/`TodosController`.
- Thêm Guards/Interceptors (đã cân nhắc nhưng loại khỏi scope "cơ bản").
- Thêm multi-user + JWT auth khi muốn học Auth.
