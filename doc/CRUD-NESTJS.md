# Chuẩn CRUD trong NestJS

Một resource CRUD chuẩn trong NestJS thường gồm 4 phần: **Module – Controller – Service – DTO**, ánh xạ theo REST convention. Trước khi viết code CRUD, phải có **bảng (table)** trong database — với Prisma nghĩa là định nghĩa model rồi chạy migration.

> Tài liệu này dùng resource `Todo` — đúng bằng module thật đang có trong project (`src/todos/`) — làm ví dụ xuyên suốt, để bạn có thể đối chiếu trực tiếp với code thật thay vì ví dụ giả định.

## 0. Tạo bảng trước khi có data (Prisma)

### a. Định nghĩa model trong `prisma/schema.prisma`

Project hiện có model `Todo` trong `prisma/schema.prisma`:

```prisma
model Todo {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(255)
  description String?
  isDone      Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### b. Chạy migration để tạo bảng thật trong DB

```bash
npx prisma migrate dev --name init --config prisma7.config.ts
```

> Project dùng file config tên `prisma7.config.ts` (không phải tên mặc định `prisma.config.ts`), nên **mọi lệnh `prisma` đều cần thêm `--config prisma7.config.ts`** — xem đầy đủ ở mục [13. Phụ lục CLI](#13-phụ-lục--tổng-hợp-lệnh-cli-cần-dùng).

Lệnh này sẽ:

1. Tạo file migration SQL trong `prisma/migrations/`.
2. Áp dụng migration đó lên database (tạo bảng thật sự).
3. Tự động chạy `prisma generate` để sinh lại Prisma Client (`src/generated/prisma`).

### c. (Tuỳ chọn) Seed dữ liệu mẫu

Project có sẵn `prisma/seed.ts`, chạy bằng:

```bash
npx prisma db seed --config prisma7.config.ts
```

> Chỉ sau khi bảng đã tồn tại trong DB, `PrismaService`/`PrismaClient` mới có thể `create/findMany/update/delete` được — nếu chưa migrate, mọi lời gọi CRUD bên dưới sẽ lỗi kiểu `relation "xxx" does not exist`.

## 1. Cấu trúc thư mục chuẩn

Project là ESM (`"type": "module"` trong `package.json`), nên mọi import nội bộ phải có đuôi `.js` (kể cả khi import từ file `.ts`) — đây là quy ước bắt buộc của Node ESM, không phải lỗi gõ nhầm.

```
src/
  todos/
    dto/
      create-todo.dto.ts
      update-todo.dto.ts
    todos.controller.ts
    todos.service.ts
    todos.module.ts
  prisma/
    prisma.module.ts
    prisma.service.ts
```

> ⚠️ **Lưu ý so với schematic mặc định**: `nest g resource` mặc định còn sinh thêm thư mục `entities/` (chứa class đại diện shape trả về, dùng cho Swagger response type + `ClassSerializerInterceptor`). Project hiện tại **không dùng** `entities/` — controller/service trả thẳng type Prisma sinh ra (`Todo` từ `src/generated/prisma/models/Todo.ts`). Cách này gọn hơn cho resource đơn giản, nhưng nếu cần ẩn field nhạy cảm khỏi response thì bắt buộc phải có entity riêng (xem mục [10. Serialization](#10-optional--nâng-cao-serialization--ẩn-field-nhạy-cảm)).

### Quy trình khuyến nghị: tạo bằng CLI trước, chỉnh tay sau

Nên **luôn bắt đầu bằng CLI**, không viết tay từng file từ đầu:

```bash
nest g resource todos
```

Lệnh này chọn transport là REST API sẽ tự động:

- Tạo đủ 4 file: `todos.module.ts`, `todos.controller.ts`, `todos.service.ts`, DTO
- Tự wiring `@Module` (khai báo sẵn `controllers`/`providers`)
- Tự đăng ký `TodosModule` vào `imports` của `AppModule`
- Sinh sẵn 5 method rỗng đúng convention `create/findAll/findOne/update/remove`

→ Tránh được lỗi quên wiring hoặc gõ sai tên method — những lỗi hay gặp khi viết tay.

Sau khi CLI sinh xong, cần **chỉnh tay** để khớp chuẩn trong tài liệu này:

1. **Xoá** thư mục `entities/` và các file `*.spec.ts` mặc định nếu chưa cần ngay (viết lại đúng cách ở mục [8. Testing](#8-testing--unit-test--e2e-test) khi thực sự viết test)
2. **Bổ sung tay** decorator `class-validator` + `@ApiProperty` vào DTO (CLI chỉ sinh DTO rỗng — xem mục 4)
3. **Bổ sung tay** decorator Swagger (`@ApiTags`, `@ApiOperation`, `@ApiResponse`) vào controller (CLI không tự sinh — xem mục 6)
4. Chỉnh lại import cho đúng chuẩn ESM `.js` của project (CLI mặc định không thêm đuôi `.js` cho relative import)

## 2. Controller — map HTTP method sang route

```ts
// todos.controller.ts
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

  @Post() // Create
  create(@Body() createTodoDto: CreateTodoDto) {
    return this.todosService.create(createTodoDto);
  }

  @Get() // Read all
  findAll() {
    return this.todosService.findAll();
  }

  @Get(':id') // Read one
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.todosService.findOne(id);
  }

  @Patch(':id') // Update (partial)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateTodoDto: UpdateTodoDto) {
    return this.todosService.update(id, updateTodoDto);
  }

  @Delete(':id') // Delete
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.todosService.remove(id);
  }
}
```

| HTTP             | Method                     | Ý nghĩa                                           |
| ---------------- | -------------------------- | -------------------------------------------------- |
| POST              | `create()`                 | Tạo mới                                            |
| GET               | `findAll()` / `findOne()`  | Đọc danh sách / đọc 1                              |
| PATCH (hoặc PUT) | `update()`                 | PATCH = cập nhật một phần, PUT = thay thế toàn bộ  |
| DELETE            | `remove()`                 | Xóa (trả `204 No Content`, không có response body) |

## 3. Service — chứa logic + gọi DB (Prisma)

```ts
// todos.service.ts
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

## 4. DTO — validate input bằng `class-validator` + document bằng `@nestjs/swagger`

```ts
// create-todo.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTodoDto {
  @ApiProperty({ maxLength: 255 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

// update-todo.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTodoDto } from './create-todo.dto.js';

export class UpdateTodoDto extends PartialType(CreateTodoDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}
```

`PartialType` (từ `@nestjs/mapped-types`) tự làm mọi field thành optional cho update, **và giữ nguyên metadata Swagger/validator** đã khai báo trên `CreateTodoDto` — đây là lý do nên dùng `PartialType` thay vì viết lại DTO từ đầu.

## 5. Module — khai báo và wiring

```ts
// todos.module.ts
import { Module } from '@nestjs/common';
import { TodosService } from './todos.service.js';
import { TodosController } from './todos.controller.js';

@Module({
  controllers: [TodosController],
  providers: [TodosService],
})
export class TodosModule {}
```

Để ý `imports` ở đây **không có** `PrismaModule`, nhưng `TodosService` vẫn inject được `PrismaService` bình thường. Lý do: `PrismaModule` được khai báo `@Global()`:

```ts
// prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

`@Global()` khiến `PrismaService` khả dụng ở **mọi module** trong app mà không cần import lại — tiện cho service dùng chung như kết nối DB, nhưng chỉ nên dùng `@Global()` cho những provider thực sự "hạ tầng" như thế này, không nên lạm dụng cho các service nghiệp vụ bình thường (sẽ làm module mất tính đóng gói/khó trace dependency).

## 6. Swagger / OpenAPI — document API

Project đã bật Swagger sẵn trong `main.ts`:

```ts
// main.ts
const config = new DocumentBuilder()
  .setTitle('Todo List API')
  .setDescription('API học NestJS cơ bản — CRUD Todo, in-memory storage')
  .setVersion('1.0')
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);
```

Sau khi chạy app, xem docs tại `http://localhost:3000/api`.

DTO đã có `@ApiProperty`/`@ApiPropertyOptional` (mục 4). Để tài liệu API đầy đủ và chuẩn, controller nên bổ sung thêm:

```ts
// todos.controller.ts (bổ sung so với mục 2)
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('todos')
@Controller('todos')
export class TodosController {
  // ...

  @Post()
  @ApiOperation({ summary: 'Tạo todo mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  create(@Body() createTodoDto: CreateTodoDto) {
    return this.todosService.create(createTodoDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy 1 todo theo id' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy todo' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.todosService.findOne(id);
  }

  // ... tương tự cho findAll/update/remove
}
```

> ⚠️ **Hiện trạng project**: `TodosController` **chưa có** `@ApiTags`, `@ApiOperation`, `@ApiResponse` — Swagger UI hiện chỉ hiển thị route + schema DTO (nhờ `@ApiProperty`), thiếu mô tả nghiệp vụ và các mã lỗi có thể trả về.

## 7. Exception filter — chuẩn hoá lỗi Prisma thành HTTP status đúng

Prisma ném lỗi dạng `PrismaClientKnownRequestError` với mã lỗi riêng (`P2002` = unique constraint, `P2025` = record không tồn tại...). Nếu không bắt, NestJS sẽ trả `500 Internal Server Error` cho mọi lỗi DB — sai ý nghĩa HTTP status. Cách chuẩn là viết 1 `ExceptionFilter` dùng chung cho toàn app thay vì try/catch rải rác trong từng service:

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
      case 'P2002': { // unique constraint violation
        const target = (exception.meta?.target as string[])?.join(', ');
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: `Giá trị đã tồn tại cho field: ${target}`,
        });
      }
      case 'P2025': // record không tồn tại (update/delete trên id không có thật)
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

Đăng ký global trong `main.ts`:

```ts
app.useGlobalFilters(new PrismaExceptionFilter());
```

> ⚠️ **Hiện trạng project**: chưa có `PrismaExceptionFilter` nào được implement — `TodosService.create()` nếu gọi trùng dữ liệu unique (nếu sau này thêm field `@unique`) sẽ trả `500` thay vì `409 Conflict`. Mục [12. Checklist](#12-checklist--đồng-bộ-code-thật-với-chuẩn-trong-tài-liệu) có ghi lại việc này.

## 8. Testing — unit test & e2e test

Project dùng `vitest` (không phải Jest mặc định của `nest new`), có sẵn `vitest.config.ts` (unit) và `vitest.config.e2e.ts` (e2e) + `supertest`.

### a. Unit test cho Service — mock `PrismaService`

```ts
// todos.service.spec.ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TodosService } from './todos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('TodosService', () => {
  let service: TodosService;
  const prismaMock = {
    todo: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [TodosService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(TodosService);
    vi.clearAllMocks();
  });

  it('findOne ném NotFoundException khi không tìm thấy', async () => {
    prismaMock.todo.findUnique.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('create gọi prisma.todo.create với đúng data', async () => {
    const dto = { title: 'Học NestJS' };
    prismaMock.todo.create.mockResolvedValue({ id: 1, ...dto });
    const result = await service.create(dto as any);
    expect(prismaMock.todo.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual({ id: 1, ...dto });
  });
});
```

### b. Unit test cho Controller — mock Service

```ts
// todos.controller.spec.ts
import { Test } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TodosController } from './todos.controller.js';
import { TodosService } from './todos.service.js';

describe('TodosController', () => {
  let controller: TodosController;
  const serviceMock = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TodosController],
      providers: [{ provide: TodosService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(TodosController);
  });

  it('findAll uỷ quyền xuống service', async () => {
    serviceMock.findAll.mockResolvedValue([]);
    expect(await controller.findAll()).toEqual([]);
    expect(serviceMock.findAll).toHaveBeenCalled();
  });
});
```

### c. e2e test — gọi thật qua HTTP (dùng `supertest`)

```ts
// test/todos.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('Todos (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /todos tạo mới và trả 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Viết doc CRUD' })
      .expect(201);

    expect(res.body).toMatchObject({ title: 'Viết doc CRUD', isDone: false });
  });

  it('GET /todos/:id trả 404 khi không tồn tại', async () => {
    await request(app.getHttpServer()).get('/todos/999999').expect(404);
  });
});
```

Chạy:

```bash
npm run test        # unit test
npm run test:e2e     # e2e test
npm run test:cov     # coverage
```

> ⚠️ **Hiện trạng project**: hiện chỉ có `src/app.controller.spec.ts` và `test/app.e2e-spec.ts` (mẫu mặc định của `nest new`). **Chưa có bất kỳ test nào cho module `todos`** — cả unit lẫn e2e.

## 9. Quy ước / best practice đi kèm

- **ValidationPipe global** (trong `main.ts`) để DTO tự validate:

  ```ts
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // tự động bỏ field lạ không khai báo trong DTO
      forbidNonWhitelisted: true, // ném lỗi 400 nếu client gửi field lạ (thay vì âm thầm bỏ qua)
      transform: true, // tự convert type (vd. query string "1" -> number 1)
    }),
  );
  ```

- Ném lỗi bằng `NotFoundException`, `BadRequestException`, `ConflictException`... để trả đúng HTTP status — kết hợp exception filter ở mục 7 cho lỗi tầng DB.
- Service không phụ thuộc vào `Request/Response` của Express — giữ logic thuần, dễ test (xem mục 8).
- Đặt tên method service theo convention: `create / findAll / findOne / update / remove` (đây là convention mà `nest g resource` sinh ra mặc định).
- **Đọc biến môi trường qua `ConfigService`**, không đọc thẳng `process.env`:

  ```ts
  // prisma.service.ts — nên viết thế này
  import { ConfigService } from '@nestjs/config';

  @Injectable()
  export class PrismaService extends PrismaClient {
    constructor(config: ConfigService) {
      super({
        adapter: new PrismaPg({ connectionString: config.get<string>('DATABASE_URL') }),
      });
    }
  }
  ```

  Lợi ích: type-safe hơn, dễ mock trong test, có thể validate schema biến môi trường tập trung (`ConfigModule.forRoot({ validationSchema })`).

  > ⚠️ **Hiện trạng project**: `ConfigModule.forRoot({ isGlobal: true })` đã được đăng ký trong `app.module.ts`, nhưng **chưa có nơi nào thực sự dùng `ConfigService`** — `PrismaService` vẫn đọc thẳng `process.env.DATABASE_URL`.

## 10. (Optional / nâng cao) Serialization — ẩn field nhạy cảm

`Todo` hiện tại không có field nào cần ẩn, nên project chưa cần mục này. Nhưng đây là kỹ thuật chuẩn NestJS đáng biết cho resource khác (vd. `User` có `password`, hoặc `Todo` giả sử có thêm field nội bộ `internalNote` không muốn lộ ra API).

```ts
// giả định Todo có thêm field internalNote cần ẩn khỏi response
import { Exclude } from 'class-transformer';

export class TodoEntity {
  id: number;
  title: string;
  description?: string;
  isDone: boolean;

  @Exclude()
  internalNote: string;
}
```

Bật global trong `main.ts`:

```ts
import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

Service/controller khi đó nên trả về instance của `TodoEntity` (hoặc dùng `plainToInstance`) thay vì trả thẳng object Prisma, để `@Exclude()` có hiệu lực.

## 11. (Optional / nâng cao) Pagination cho `findAll()`

Khi số lượng `Todo` lớn, `findAll()` trả hết toàn bộ bảng sẽ chậm dần. Chuẩn NestJS thường dùng `@Query()` + DTO riêng cho pagination:

```ts
// dto/pagination.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;
}
```

```ts
// todos.controller.ts
@Get()
findAll(@Query() pagination: PaginationDto) {
  return this.todosService.findAll(pagination);
}

// todos.service.ts
findAll({ page, limit }: PaginationDto) {
  return this.prisma.todo.findMany({
    skip: (page - 1) * limit,
    take: limit,
  });
}
```

> ⚠️ **Hiện trạng project**: `findAll()` hiện chưa phân trang — trả toàn bộ bảng `Todo` trong 1 lần gọi.

## 12. Checklist — đồng bộ code thật với chuẩn trong tài liệu

Các điểm sau đây **đang thiếu trong code thật** (`src/todos`, `src/prisma`, `main.ts`) so với chuẩn được mô tả ở trên. Đây là tài liệu tham khảo — checklist này KHÔNG tự động áp dụng, cần làm ở task riêng nếu muốn đồng bộ:

- [ ] `TodosController` chưa có `@ApiTags`, `@ApiOperation`, `@ApiResponse` (mục 6)
- [ ] Chưa có `PrismaExceptionFilter` xử lý lỗi Prisma (`P2002`, `P2025`...) — lỗi DB hiện trả `500` thay vì status HTTP đúng (mục 7)
- [ ] Chưa có unit test / e2e test nào cho module `todos` (mục 8)
- [ ] `ConfigModule` đã đăng ký global nhưng `ConfigService` chưa được dùng ở đâu — `PrismaService` vẫn đọc thẳng `process.env.DATABASE_URL` (mục 9)
- [ ] `findAll()` chưa có pagination (mục 11 — optional, tuỳ nhu cầu thực tế)
- [ ] `entities/` (nếu sau này cần ẩn field nhạy cảm) chưa tồn tại — hiện không cần vì `Todo` không có field nhạy cảm (mục 10 — optional)

## 13. Phụ lục — Tổng hợp lệnh CLI cần dùng

> ⚠️ Project dùng file config **`prisma7.config.ts`** (không phải tên mặc định `prisma.config.ts`), nên **mọi lệnh `prisma` đều cần thêm `--config prisma7.config.ts`**, nếu không Prisma CLI sẽ không tìm thấy config và báo lỗi thiếu `schema.prisma`/`DATABASE_URL`.

### a. Nest CLI — khởi tạo & sinh code

| Lệnh | Dùng khi nào |
| --- | --- |
| `nest new <ten-project>` | Tạo project NestJS mới từ đầu (không cần nếu project đã có sẵn) |
| `nest g resource todos` | Sinh nhanh khung 1 resource CRUD đầy đủ (mục 1) — **cách khuyến nghị** |
| `nest g module todos` | Chỉ sinh riêng `todos.module.ts` (nếu không dùng `g resource`) |
| `nest g controller todos --no-spec` | Chỉ sinh riêng `todos.controller.ts`, bỏ qua file test mẫu |
| `nest g service todos --no-spec` | Chỉ sinh riêng `todos.service.ts`, bỏ qua file test mẫu |
| `nest g class todos/dto/create-todo --no-spec` | Sinh 1 class DTO riêng lẻ |
| `nest build` | Build production (`npm run build` đã wrap sẵn lệnh này) |
| `nest start --watch` | Chạy dev với hot-reload (`npm run start:dev` đã wrap sẵn lệnh này) |

### b. Prisma CLI — quản lý schema & database

| Lệnh | Dùng khi nào |
| --- | --- |
| `npx prisma init --config prisma7.config.ts` | Khởi tạo `schema.prisma` + `.env` ban đầu (chỉ cần nếu project chưa có Prisma) |
| `npx prisma format --config prisma7.config.ts` | Tự format lại `schema.prisma` cho đúng convention |
| `npx prisma validate --config prisma7.config.ts` | Kiểm tra `schema.prisma` có hợp lệ không, không đụng DB |
| `npx prisma migrate dev --name <ten-migration> --config prisma7.config.ts` | Tạo bảng lần đầu / mỗi khi đổi `schema.prisma` (mục 0.b) — chỉ dùng ở **dev** |
| `npx prisma generate --config prisma7.config.ts` | Sinh lại Prisma Client (`src/generated/prisma`) mà không tạo migration mới — dùng khi clone project về máy mới, `node_modules` bị xoá, hoặc sau khi đổi `schema.prisma` mà không cần migrate lại |
| `npx prisma migrate deploy --config prisma7.config.ts` | Áp dụng các migration đã có lên **production/staging** — không tạo migration mới, an toàn cho CI/CD |
| `npx prisma migrate reset --config prisma7.config.ts` | ⚠️ Xoá sạch dữ liệu, chạy lại toàn bộ migration + seed từ đầu — chỉ dùng ở **dev** khi muốn làm sạch DB |
| `npx prisma db seed --config prisma7.config.ts` | Chạy `prisma/seed.ts` để tạo dữ liệu mẫu (mục 0.c) |
| `npx prisma studio --config prisma7.config.ts` | Mở GUI trên trình duyệt để xem/sửa data trực tiếp trong DB |

### c. npm scripts — chạy app & kiểm thử (định nghĩa sẵn trong `package.json`)

| Lệnh | Dùng khi nào |
| --- | --- |
| `npm run start:dev` | Chạy app ở chế độ dev, tự reload khi sửa code |
| `npm run start:debug` | Chạy dev kèm debugger (`--inspect`) |
| `npm run build` | Build ra `dist/` cho production |
| `npm run start:prod` | Chạy bản build production (`node dist/main`) |
| `npm run lint` | Kiểm tra lỗi lint bằng `oxlint` |
| `npm run format` | Tự format code bằng `prettier` |
| `npm run test` | Chạy toàn bộ unit test (mục 8.a, 8.b) |
| `npm run test:watch` | Chạy unit test ở chế độ watch, tự chạy lại khi sửa code |
| `npm run test:cov` | Chạy unit test kèm báo cáo coverage |
| `npm run test:debug` | Chạy unit test kèm debugger, không chạy song song |
| `npm run test:e2e` | Chạy e2e test (mục 8.c), dùng `vitest.config.e2e.ts` riêng |
