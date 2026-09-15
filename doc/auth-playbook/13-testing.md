# 13 — Testing (Unit + E2E)

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [12-rate-limiting.md](./12-rate-limiting.md) — toàn bộ endpoint, guard, và rate limit đã implement. Tham chiếu chung: [00-overview.md](./00-overview.md).

Toàn bộ service có business logic (`AuthService`, `TokenService`, `PasswordService`) cần có unit test; toàn bộ flow `/auth/*` cần có e2e test — bắt buộc theo `doc/api-conventions.md`, không phải tuỳ chọn.

> 📘 **Khái niệm — Unit test vs E2E test, vì sao cần cả 2?**
>
> |             | Unit test                                                      | E2E test                                                                                                       |
> | ----------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
> | Test cái gì | 1 class riêng lẻ (vd chỉ `AuthService`)                        | Toàn bộ flow HTTP thật, từ request tới response                                                                |
> | Dependency  | Mock hết (Prisma, MailService...) — không đụng DB/network thật | Chạy với DB test thật, không mock                                                                              |
> | Tốc độ      | Rất nhanh (không I/O thật)                                     | Chậm hơn (có I/O thật)                                                                                         |
> | Bắt lỗi gì  | Logic sai trong 1 hàm (if/else sai, quên check case nào đó)    | Wiring sai giữa các lớp (DI thiếu, route không đúng, Guard không áp dụng, DTO không validate đúng như kỳ vọng) |
>
> Unit test không bắt được lỗi kiểu "quên đăng ký Guard vào route" (vì mock hết, không chạy Guard thật) — đó là lý do auth (nơi Guard/pipeline bảo mật cực kỳ quan trọng) **bắt buộc phải có e2e test**, không thể chỉ dựa vào unit test.

---

## Bước 1 — Unit test

Các file cần tạo: `src/auth/services/auth.service.spec.ts`, `src/auth/services/token.service.spec.ts`, `src/auth/services/password.service.spec.ts`. Lệnh dùng khi viết test:

```bash
npm run test          # chạy 1 lần
npm run test:watch    # chạy lại tự động khi sửa code — dùng khi đang code
npm run test:cov      # kèm coverage report
```

> 📘 **Khái niệm — `Test.createTestingModule` + `overrideProvider`:** NestJS cung cấp `@nestjs/testing` để dựng 1 "module giả lập" chỉ chứa provider cần test, thay các dependency thật (`PrismaService`, `MailService`...) bằng mock object (`jest.fn()`). Nhờ vậy test chạy độc lập, không cần DB/SMTP thật, và assert được chính xác "AuthService gọi đúng hàm nào với tham số nào".

Ví dụ unit test cho `AuthService.register()`:

```ts
// src/auth/services/auth.service.spec.ts
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { MailService } from '../../mail/mail.service';

describe('AuthService.register', () => {
  let authService: AuthService;
  let prisma: { user: any; $transaction: jest.Mock };
  let passwordService: { hash: jest.Mock };
  let mailService: { sendVerificationEmail: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    passwordService = { hash: jest.fn().mockResolvedValue('hashed') };
    mailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwordService },
        { provide: TokenService, useValue: {} },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  it('throws ConflictException when email already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(authService.register({ email: 'a@b.com', password: 'Abc@1234' })).rejects.toThrow(ConflictException);

    // Không được đi tiếp tới bước hash/transaction khi email đã tồn tại.
    expect(passwordService.hash).not.toHaveBeenCalled();
  });

  it('creates user and sends email when email does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockResolvedValue({
      user: { id: 'new-user', email: 'a@b.com' },
      rawToken: 'raw-token-abc',
    });

    const result = await authService.register({
      email: 'a@b.com',
      password: 'Abc@1234',
    });

    expect(result).toEqual({ id: 'new-user', email: 'a@b.com' });
    expect(mailService.sendVerificationEmail).toHaveBeenCalledWith('a@b.com', 'raw-token-abc');
  });
});
```

Viết tương tự cho `TokenService` (assert xoá token cũ trước khi tạo mới, assert raw token không bị lưu vào DB) và `PasswordService` (assert `hash()` 2 lần cho ra 2 chuỗi khác nhau nhưng cùng `verify()` đúng — đã tự thử ở [02-register.md](./02-register.md), Bước 2). Mục tiêu cuối cùng của bước này: unit test cho `AuthService`, `TokenService`, `PasswordService` pass, cover đủ các nhánh chính — happy path lẫn lỗi domain (duplicate email, token hết hạn, password sai...).

---

## Bước 2 — E2E test

File cần tạo: `test/auth.e2e-spec.ts` (hoặc theo cấu trúc `test/` hiện có của repo). Lệnh chạy:

```bash
npm run test:e2e   # đảm bảo DATABASE_URL trỏ DB test trước khi chạy, không phải DB dev
```

> 📘 **Khái niệm — `supertest`:** thư viện gửi HTTP request thật tới app NestJS đã bootstrap trong bộ nhớ (không cần chạy `npm run start` riêng), rồi assert trên response thật (status code, body, header — kể cả `Set-Cookie`). Đây là cách duy nhất để test được toàn bộ pipeline Guard → Controller → Service → DB thật.

Ví dụ e2e test cho `POST /auth/register`:

```ts
// test/auth.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true })); // giống main.ts thật
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Dọn dữ liệu test trước mỗi test case — tránh test case sau bị ảnh hưởng
    // bởi dữ liệu test case trước (vd email trùng → 409 giả).
    await prisma.user.deleteMany({
      where: { email: { contains: '@e2e-test.local' } },
    });
  });

  it('POST /auth/register -> 201 on success', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'new-user@e2e-test.local', password: 'Abc@1234' })
      .expect(201);

    expect(res.body).toEqual({
      id: expect.any(String),
      email: 'new-user@e2e-test.local',
    });
    expect(res.body.passwordHash).toBeUndefined(); // Response DTO không leak field nhạy cảm
  });

  it('POST /auth/register -> 409 when email already exists', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dup@e2e-test.local', password: 'Abc@1234' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dup@e2e-test.local', password: 'Abc@1234' })
      .expect(409);
  });

  it('POST /auth/register -> 400 when password does not meet policy', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'weak@e2e-test.local', password: 'abc12345' })
      .expect(400);
  });
});
```

Viết tương tự cho `login` (assert `Set-Cookie` có đủ `HttpOnly`/`Secure`/`SameSite`, assert body không có `refreshToken`), `refresh` (rotation + reuse detection — gọi lại cookie cũ sau khi đã rotate phải nhận 401), `logout`/`logout-all`, `forgot-password`/`reset-password`, `RolesGuard`/`OwnershipGuard`.

Dùng bảng dưới đây để double-check không sót nhóm test nào khi review lại toàn bộ ("✓" = bắt buộc có ít nhất 1 test case, unit hoặc e2e tuỳ nhóm, cho ô đó):

| Endpoint                             | Happy path | Validation | Auth | Security | Edge case |
| ------------------------------------ | :--------: | :--------: | :--: | :------: | :-------: |
| register                             |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| verify-email                         |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| resend-verification                  |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| login                                |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| refresh (rotation + reuse detection) |     ✓      |     ✓      |  ✓   |    ✓     |     ✓     |
| logout                               |     ✓      |     –      |  ✓   |    –     |     ✓     |
| logout-all                           |     ✓      |     –      |  ✓   |    –     |     ✓     |
| forgot-password                      |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| reset-password                       |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| /auth/me                             |     ✓      |     –      |  ✓   |    ✓     |     –     |
| RolesGuard                           |     ✓      |     –      |  ✓   |    ✓     |     ✓     |
| OwnershipGuard                       |     ✓      |     –      |  ✓   |    ✓     |     ✓     |
| Rate limiting (per endpoint)         |     ✓      |     –      |  –   |    ✓     |     ✓     |

"Security" = test riêng cho các rule ở [00-overview.md § 5. Security Rules](./00-overview.md) (không leak field, không lộ enumeration, rate limit hoạt động, reuse detection revoke đúng phạm vi...). Mỗi endpoint đã có sẵn danh sách case cụ thể ngay trong đoạn "tự kiểm tra" của file tương ứng (vd [02-register.md](./02-register.md), [06-refresh-token.md](./06-refresh-token.md)...) — bảng này chỉ để tra chéo cho khỏi sót nhóm.

Coi bước này là xong khi: `npm run test` pass không có test nào bị skip mà không rõ lý do; `npm run test:cov` đạt threshold coverage của project (xem [00-overview.md § Definition of Done](./00-overview.md)); `npm run test:e2e` pass với DB test riêng (không trỏ nhầm sang DB dev/production); và mỗi hàng "✓" trong bảng trên đã có ít nhất 1 test case tương ứng.

---

➡️ Tiếp theo: [14-swagger-and-wrapup.md](./14-swagger-and-wrapup.md)
