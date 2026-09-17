# Convention: Config & Environment Variables (ecommerce project)

Tài liệu này dành cho **dev trong team tự đọc và tự viết code** khi cần đọc/thêm 1 biến môi trường mới trong project. Đọc xong, bạn biết: đặt tên biến thế nào, khai bắt buộc hay optional ở đâu, và vì sao app **không boot được** nếu thiếu biến bắt buộc — thay vì tự hỏi tại sao production crash lúc nửa đêm khi gọi tới 1 endpoint ít dùng.

Convention này áp dụng cho **mọi** biến môi trường app đọc lúc runtime (không áp dụng cho biến chỉ dùng bởi script/tool ngoài app, vd. `POSTMAN_API_KEY` — xem [§4](#4-biến-bắt-buộc-vs-biến-optional)).

## 1. Nguyên tắc cốt lõi: không đọc thẳng `process.env`

**Mọi nơi trong `../../src` đọc biến môi trường qua `ConfigService`** (`@nestjs/config`), không bao giờ đọc thẳng `process.env.X`. Lý do:

- `ConfigService` đi qua bước validate ở [§3](#3-validate-lúc-startup-fail-fast) — đọc thẳng `process.env` bỏ qua bước này, biến sai định dạng/thiếu vẫn "chạy được" tới khi đúng dòng code đó được gọi.
- Test dễ hơn: mock `ConfigService` trong unit test, không cần set `process.env` thật trước khi import module.

```ts
// ✗ Sai — bỏ qua validate, khó test
const dbUrl = process.env.DATABASE_URL;

// ✓ Đúng
constructor(private readonly config: ConfigService) {}
const dbUrl = this.config.get<string>('DATABASE_URL');
```

> **Không có ngoại lệ cho việc đọc `process.env` trực tiếp** — trường hợp dưới đây vẫn 100% dùng `ConfigService`, chỉ khác ở **cách gọi**: class extend 1 class khác (vd. `PrismaService extends PrismaClient`) cần giá trị config **trước khi gọi `super()`**, nên phải lấy qua **tham số constructor** (dùng được trước `super()`), không phải `this.config` (chỉ gán được sau `super()`, do TypeScript tự chèn `this.config = config` ngay sau lệnh `super()`):

```ts
// src/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({ connectionString: config.get<string>('DATABASE_URL') }),
    });
  }
}
```

## 2. Đặt tên biến môi trường

- `UPPER_SNAKE_CASE`, tiếng Anh.
- Prefix theo nhóm chức năng để dễ tìm trong `../../.env`/`.env.example`: `JWT_*`, `REFRESH_TOKEN_*`, `SMTP_*`, `ADMIN_BOOTSTRAP_*`... Biến đứng riêng lẻ không thuộc nhóm nào (`PORT`, `FRONTEND_URL`, `DATABASE_URL`) thì giữ tên ngắn gọn, không cần prefix giả.
- Đơn vị thời gian dùng string dạng `ms`-compatible (`15m`, `7d`) thay vì số giây/ms trần — khớp cách `token.service.ts`/`auth.controller.ts` đang parse bằng package `ms`.

## 3. Validate lúc startup (fail-fast)

Project khai `EnvironmentVariables` ở `../../src/config/env.validation.ts` bằng `class-validator`/`class-transformer` (đã là dependency sẵn có — không cần thêm Joi/Zod), và truyền hàm `validate` vào `ConfigModule.forRoot`:

```ts
// src/config/env.validation.ts
export class EnvironmentVariables {
  @IsString()
  @MinLength(1)
  DATABASE_URL: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;
  // ... các field khác, xem file thật
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Biến môi trường không hợp lệ — kiểm tra lại .env: ${/* ... */ ''}`);
  }
  return validated;
}
```

```ts
// src/app.module.ts
ConfigModule.forRoot({ isGlobal: true, validate });
```

Kết quả: **thiếu hoặc sai định dạng 1 biến bắt buộc → app throw ngay lúc `NestFactory.create()`, không boot lên được** — thay vì boot thành công rồi lỗi `undefined`/`500` khi có request đầu tiên chạm tới biến đó (thường là ở production, lúc dở khóc dở cười nhất).

> `enableImplicitConversion: true` khiến `class-transformer` tự chuyển kiểu theo type khai trong class (vd. `PORT?: number` → chuỗi `"3000"` từ `../../.env` được convert thành số `3000`) — nhờ vậy `ConfigService.get('PORT', 3000)` trả về `number` thật, không phải string.

## 4. Biến bắt buộc vs biến optional

- **Bắt buộc** (không có `@IsOptional()` trong `EnvironmentVariables`): app **không có cách nào chạy đúng** nếu thiếu — vd. `DATABASE_URL`, `JWT_ACCESS_SECRET`, `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`.
- **Optional có default** (`@IsOptional()` trong class + `config.get(key, defaultValue)` ở nơi dùng): app chạy được nếu thiếu, dùng default hợp lý — vd. `PORT` (default `3000`), `SMTP_*` (thiếu cả 4 → mail service tự chuyển sang chế độ chỉ log, không gửi thật), `FRONTEND_URL` (default `http://localhost:3000`).
- **Không thuộc `EnvironmentVariables`**: biến chỉ dùng bởi script/tool chạy **ngoài** vòng đời NestJS app, không qua `ConfigModule` — vd. `POSTMAN_API_KEY`/`POSTMAN_COLLECTION_ID` (chỉ dùng trong `../../scripts/sync-postman-collection.ts`, script tự đọc `.env` riêng qua `dotenv`, không phải `ConfigService`).

Khi thêm biến mới, tự hỏi: "Thiếu biến này thì app có chạy sai/crash ở nhánh code quan trọng không?" — có thì bắt buộc, không thì optional + default rõ ràng tại nơi dùng.

## 5. `../../.env.example` luôn phải đồng bộ

Mọi biến môi trường mới **phải** có 1 dòng tương ứng trong `../../.env.example` (để trống giá trị, kèm comment giải thích nếu không tự nói lên ý nghĩa) — trong **cùng PR** thêm biến đó vào code. `.env.example` là nguồn duy nhất để biết "project cần những biến gì" khi setup máy mới hoặc CI — không suy luận ngược từ code.

```bash
# .env.example — mẫu 1 biến optional có giải thích
# Base URL của frontend — dùng để build link trong email (verify-email,
# forgot-password). Bỏ trống thì mặc định http://localhost:3000.
FRONTEND_URL=
```

## 6. Secrets — không commit, không hardcode

- `../../.env` đã nằm trong `.gitignore` — không bao giờ commit file này hay bất kỳ giá trị secret thật nào (kể cả trong comment, commit message, hay code mẫu).
- Secret thật ở staging/production do platform deploy/CI secret store quản lý (ngoài phạm vi convention này — mỗi platform có cơ chế riêng, vd. GitHub Actions secrets, container orchestrator secret).
- Nếu 1 biến bắt buộc bị lộ (leak) — coi là security incident, xoay vòng (rotate) giá trị đó ngay, không chỉ xoá khỏi commit history.

## Checklist khi thêm biến môi trường mới

- [ ] Đặt tên `UPPER_SNAKE_CASE`, đúng prefix nhóm chức năng (nếu có nhóm liên quan)
- [ ] Thêm field vào `../../src/config/env.validation.ts` — bắt buộc (không `@IsOptional()`) hay optional (`@IsOptional()` + default ở nơi `config.get()`)
- [ ] Thêm dòng tương ứng vào `../../.env.example` (để trống giá trị, kèm comment nếu cần) — cùng PR
- [ ] Đọc biến qua `ConfigService.get()`/`getOrThrow()`, không đọc thẳng `process.env` — kể cả khi extend 1 class khác cần giá trị trước `super()`, vẫn dùng `ConfigService` qua tham số constructor (xem [§1](#1-nguyên-tắc-cốt-lõi-không-đọc-thẳng-processenv))
- [ ] Nếu là secret: xác nhận không hardcode giá trị thật ở đâu trong code/test/comment
