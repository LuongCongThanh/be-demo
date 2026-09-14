# 13 — Testing (Unit + E2E)

> ⬅️ Trước khi làm file này: xong [12-rate-limiting.md](./12-rate-limiting.md) (toàn bộ endpoint + guard + rate limit đã implement).
> 📚 Tham chiếu chung: [00-overview.md](./00-overview.md).

**Goal:** Toàn bộ service có business logic (`AuthService`, `TokenService`, `PasswordService`) có unit test; toàn bộ flow `/auth/*` có e2e test (bắt buộc theo `doc/api-conventions.md`).

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

## Unit test

**Files:** `src/auth/services/auth.service.spec.ts`, `src/auth/services/token.service.spec.ts`, `src/auth/services/password.service.spec.ts`

**CLI:**

```bash
npm run test          # chạy 1 lần
npm run test:watch    # chạy lại tự động khi sửa code — dùng khi đang code
npm run test:cov      # kèm coverage report
```

**Implementation — ví dụ unit test cho `AuthService.register()`:**

> 📘 **Khái niệm — `Test.createTestingModule` + `overrideProvider`:** NestJS cung cấp `@nestjs/testing` để dựng 1 "module giả lập" chỉ chứa provider cần test, thay các dependency thật (`PrismaService`, `MailService`...) bằng mock object (`jest.fn()`). Nhờ vậy test chạy độc lập, không cần DB/SMTP thật, và assert được chính xác "AuthService gọi đúng hàm nào với tham số nào".

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

  it('ném ConflictException khi email đã tồn tại', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      authService.register({ email: 'a@b.com', password: 'Abc@1234' }),
    ).rejects.toThrow(ConflictException);

    // Không được đi tiếp tới bước hash/transaction khi email đã tồn tại.
    expect(passwordService.hash).not.toHaveBeenCalled();
  });

  it('tạo user + gửi mail khi email chưa tồn tại', async () => {
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
    expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
      'a@b.com',
      'raw-token-abc',
    );
  });
});
```

> Viết tương tự cho `TokenService` (assert xoá token cũ trước khi tạo mới, assert raw token không bị lưu vào DB) và `PasswordService` (assert `hash()` 2 lần cho ra 2 chuỗi khác nhau nhưng cùng `verify()` đúng — đã có ở [02-register.md STEP 5.2](./02-register.md)).

**Acceptance Criteria:** unit test cho `AuthService`, `TokenService`, `PasswordService` pass, cover đủ các nhánh chính (happy path + lỗi domain: duplicate email, token hết hạn, password sai...).

---

## E2E test

**Files:** `test/auth.e2e-spec.ts` (hoặc theo cấu trúc `test/` hiện có của repo)

**CLI:**

```bash
npm run test:e2e   # đảm bảo DATABASE_URL trỏ DB test trước khi chạy, không phải DB dev
```

**Implementation — ví dụ e2e test cho `POST /auth/register`:**

> 📘 **Khái niệm — `supertest`:** thư viện gửi HTTP request thật tới app NestJS đã bootstrap trong bộ nhớ (không cần chạy `npm run start` riêng), rồi assert trên response thật (status code, body, header — kể cả `Set-Cookie`). Đây là cách duy nhất để test được toàn bộ pipeline Guard → Controller → Service → DB thật.

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

  it('POST /auth/register → 201 khi thành công', async () => {
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

  it('POST /auth/register → 409 khi email đã tồn tại', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dup@e2e-test.local', password: 'Abc@1234' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dup@e2e-test.local', password: 'Abc@1234' })
      .expect(409);
  });

  it('POST /auth/register → 400 khi password không đủ policy', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'weak@e2e-test.local', password: 'abc12345' })
      .expect(400);
  });
});
```

> Viết tương tự cho `login` (assert `Set-Cookie` có đủ `HttpOnly`/`Secure`/`SameSite`, assert body không có `refreshToken`), `refresh` (rotation + reuse detection — gọi lại cookie cũ sau khi đã rotate phải nhận 401), `logout`/`logout-all`, `forgot-password`/`reset-password`, `RolesGuard`/`OwnershipGuard`.

**Acceptance Criteria + bảng test matrix đầy đủ** (tham chiếu khi lập checklist, "✓" = bắt buộc có test case cho nhóm đó):

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

"Security" = test riêng cho các rule ở [00-overview.md § 6. Security Rules](./00-overview.md) (không leak field, không lộ enumeration, rate limit hoạt động, reuse detection revoke đúng phạm vi...). Danh sách test case chi tiết từng endpoint đã liệt kê trong file tương ứng (vd [02-register.md](./02-register.md) mục **Tests**, [06-refresh-token.md](./06-refresh-token.md) mục **Tests**...) — dùng bảng này để double-check không sót nhóm nào khi review PR.

**Acceptance Criteria:**

- [ ] `npm run test` pass, không có test bị skip không rõ lý do.
- [ ] `npm run test:cov` đạt threshold coverage của project (xem `00-overview.md § Definition of Done`).
- [ ] `npm run test:e2e` pass với DB test riêng (không trỏ nhầm DB dev/production).
- [ ] Mỗi hàng "✓" trong bảng test matrix trên có ít nhất 1 test case tương ứng (unit hoặc e2e, tuỳ nhóm).

---

➡️ Tiếp theo: [14-swagger-and-wrapup.md](./14-swagger-and-wrapup.md)
