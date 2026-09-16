# 13: Testing (Unit + E2E)

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [12-rate-limiting.md](./12-rate-limiting.md): toàn bộ endpoint, guard, và rate limit đã implement. Tham chiếu chung: [00-overview.md](./00-overview.md).

Toàn bộ service có business logic (`AuthService`, `TokenService`, `PasswordService`) cần có unit test; toàn bộ flow `/auth/*` cần có e2e test. Đây là yêu cầu bắt buộc theo `doc/api-conventions.md`, không phải tuỳ chọn.

> 📘 **Khái niệm: Unit test vs E2E test, vì sao cần cả 2?**
>
> |             | Unit test                                                     | E2E test                                                                                                       |
> | ----------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
> | Test cái gì | 1 class riêng lẻ (vd chỉ `AuthService`)                       | Toàn bộ flow HTTP thật, từ request tới response                                                                |
> | Dependency  | Mock hết (Prisma, MailService...), không đụng DB/network thật | Chạy với DB test thật, không mock                                                                              |
> | Tốc độ      | Rất nhanh (không I/O thật)                                    | Chậm hơn (có I/O thật)                                                                                         |
> | Bắt lỗi gì  | Logic sai trong 1 hàm (if/else sai, quên check case nào đó)   | Wiring sai giữa các lớp (DI thiếu, route không đúng, Guard không áp dụng, DTO không validate đúng như kỳ vọng) |
>
> Unit test không bắt được lỗi kiểu "quên đăng ký Guard vào route" (vì mock hết, không chạy Guard thật). Đó là lý do auth (nơi Guard/pipeline bảo mật cực kỳ quan trọng) bắt buộc phải có e2e test, không thể chỉ dựa vào unit test.

---

## Bước 1: Unit test

Các file cần tạo: `src/auth/services/auth.service.spec.ts`, `src/auth/services/token.service.spec.ts`, `src/auth/services/password.service.spec.ts`. Lệnh dùng khi viết test:

```bash
npm run test          # chạy 1 lần
npm run test:watch    # chạy lại tự động khi sửa code — dùng khi đang code
npm run test:cov      # kèm coverage report
```

> 📘 **Khái niệm: `Test.createTestingModule` + mock provider?** Repo này dùng **Vitest** (không phải Jest — kiểm tra `package.json § scripts.test`), với `globals: true` trong `vitest.config.ts`, nên `describe`/`it`/`expect`/`vi` dùng được trực tiếp mà không cần import. NestJS cung cấp `@nestjs/testing` để dựng 1 "module giả lập" chỉ chứa provider cần test, thay các dependency thật (`PrismaService`, `MailService`...) bằng mock object (`vi.fn()`). Nhờ vậy test chạy độc lập, không cần DB/SMTP thật, và assert được chính xác "AuthService gọi đúng hàm nào với tham số nào". (Các spec file thật trong repo, vd `src/auth/services/auth.service.spec.ts`, còn dùng cách gọn hơn: tự khởi tạo `new AuthService(...)` với mock object truyền tay, không qua `Test.createTestingModule` — cả 2 cách đều hợp lệ, chọn cách bạn thấy dễ đọc hơn.)

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
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> }; $transaction: ReturnType<typeof vi.fn> };
  let passwordService: { hash: ReturnType<typeof vi.fn> };
  let mailService: { sendVerificationEmail: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: vi.fn() },
      $transaction: vi.fn(),
    };
    passwordService = { hash: vi.fn().mockResolvedValue('hashed') };
    mailService = {
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
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

    await expect(
      authService.register({ email: 'a@b.com', password: 'Abc@1234', fullName: 'Nguyen Van A', phone: '0912345678' }),
    ).rejects.toThrow(ConflictException);

    // Không được đi tiếp tới bước hash/transaction khi email đã tồn tại.
    expect(passwordService.hash).not.toHaveBeenCalled();
  });

  it('creates user and sends email when email does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockResolvedValue({
      user: { id: 'new-user', email: 'a@b.com' },
      rawCode: 'raw-code-abc',
    });

    const result = await authService.register({
      email: 'a@b.com',
      password: 'Abc@1234',
      fullName: 'Nguyen Van A',
      phone: '0912345678',
    });

    expect(result).toEqual({ id: 'new-user', email: 'a@b.com' });
    expect(mailService.sendVerificationEmail).toHaveBeenCalledWith('a@b.com', 'raw-code-abc');
  });
});
```

Viết tương tự cho `TokenService` (assert xoá token cũ trước khi tạo mới, assert raw code không bị lưu vào DB) và `PasswordService` (assert `hash()` 2 lần cho ra 2 chuỗi khác nhau nhưng cùng `verify()` đúng; đã tự thử ở [02-register.md](./02-register.md), Bước 2). Mục tiêu cuối cùng của bước này: unit test cho `AuthService`, `TokenService`, `PasswordService` pass, cover đủ các nhánh chính, gồm cả happy path lẫn lỗi domain (duplicate email, token hết hạn, password sai...).

---

## Bước 2: E2E test

File cần tạo: `test/auth.e2e-spec.ts` (hoặc theo cấu trúc `test/` hiện có của repo). Lệnh chạy:

```bash
npm run test:e2e   # đảm bảo DATABASE_URL trỏ DB test trước khi chạy, không phải DB dev
```

> 📘 **Khái niệm: `supertest`?** Thư viện gửi HTTP request thật tới app NestJS đã bootstrap trong bộ nhớ (không cần chạy `npm run start` riêng), rồi assert trên response thật (status code, body, header, kể cả `Set-Cookie`). Đây là cách duy nhất để test được toàn bộ pipeline Guard → Controller → Service → DB thật.

Ví dụ e2e test cho `POST /auth/register`:

```ts
// test/auth.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureApp } from '../src/bootstrap/configure-app.js'; // cùng setup ValidationPipe với main.ts thật, để test không lệch cấu hình

// fullName/phone là field bắt buộc của RegisterDto (02-register.md Bước 1)
// nhưng không phải trọng tâm của phần lớn test case dưới đây — 1 payload hợp
// lệ dùng chung giúp phần override riêng của từng test dễ thấy hơn.
function validRegisterPayload(overrides: Record<string, unknown> = {}) {
  return {
    password: 'Abc@1234',
    fullName: 'Nguyen Van A',
    phone: '0912345678',
    ...overrides,
  };
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
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
      .send(validRegisterPayload({ email: 'new-user@e2e-test.local' }))
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
      .send(validRegisterPayload({ email: 'dup@e2e-test.local' }))
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(validRegisterPayload({ email: 'dup@e2e-test.local' }))
      .expect(409);
  });

  it('POST /auth/register -> 400 when password does not meet policy', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(validRegisterPayload({ email: 'weak@e2e-test.local', password: 'abc12345' }))
      .expect(400);
  });
});
```

Viết tương tự cho `login` (assert `Set-Cookie` có đủ `HttpOnly`/`Secure`/`SameSite`, assert body không có `refreshToken`), `refresh` (rotation + reuse detection: gọi lại cookie cũ sau khi đã rotate phải nhận 401), `logout`/`logout-all`, `forgot-password`/`reset-password`, `RolesGuard`/`OwnershipGuard`.

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

"Security" = test riêng cho các rule ở [00-overview.md § 5. Security Rules](./00-overview.md) (không leak field, không lộ enumeration, rate limit hoạt động, reuse detection revoke đúng phạm vi...). Mỗi endpoint đã có sẵn danh sách case cụ thể ngay trong đoạn "tự kiểm tra" của file tương ứng (vd [02-register.md](./02-register.md), [06-refresh-token.md](./06-refresh-token.md)...); bảng này chỉ để tra chéo cho khỏi sót nhóm.

Coi bước này là xong khi: `npm run test` pass không có test nào bị skip mà không rõ lý do; `npm run test:cov` đạt threshold coverage của project (xem [00-overview.md § Definition of Done](./00-overview.md)); `npm run test:e2e` pass với DB test riêng (không trỏ nhầm sang DB dev/production); và mỗi hàng "✓" trong bảng trên đã có ít nhất 1 test case tương ứng.

---

➡️ Tiếp theo: [14-swagger-and-wrapup.md](./14-swagger-and-wrapup.md)
