# Phase 1 — Infrastructure Foundation Implementation Plan

> **Cho agent thực thi:** REQUIRED SUB-SKILL: dùng superpowers:subagent-driven-development (khuyến nghị) hoặc superpowers:executing-plans để thực thi plan này theo từng task. Các step dùng checkbox (`- [ ]`) để track tiến độ.

**Mục tiêu:** Migrate runtime sang `/api/v1/*` + `/docs`, migrate role sang 4 role chuẩn kèm cơ chế revoke bằng `authorization_version`, thêm health check + graceful shutdown, thêm Prometheus metrics cơ bản, và thêm Docker/Compose local + CI — 6 prerequisite ở Mục 22 Phase 1 của `doc/ecommerce-backend-architecture-system-design-2.md` mà mọi phase sau (Categories, Products, ...) phụ thuộc vào.

**Kiến trúc:** Hoàn toàn additive lên layout NestJS modular-monolith hiện có — không move file nào đã có, không tạo folder module nghiệp vụ mới nào (cây ở Mục 3 là đích cuối của cả 9 phase, không phải checklist của Phase 1). Hai module hạ tầng mới (`src/health/`, `src/metrics/`) nằm phẳng dưới `src/`, cùng cấp `src/mail/`/`src/prisma/`. Config versioning/shutdown nằm ở `configureApp()` dùng chung (đã được cả `main.ts` và `test/support/create-test-app.ts` dùng, nên e2e test chạy đúng cùng config với production).

**Tech Stack:** NestJS 12, Prisma 7 (`@prisma/adapter-pg`), `@nestjs/terminus` (health), `prom-client` (metrics), Docker + Docker Compose, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-18-phase-1-infrastructure-foundation-design.md`

## Global Constraints

- Không tạo folder module nghiệp vụ top-level mới nào (`products/`, `users/`, `cart/`, `orders/`, `inventory/`, `payments/`, `promotions/`) — các module đó được tạo ở phase riêng của chúng (Mục 22), không phải ở đây.
- Không có barrel file (`index.ts`) ở đâu trong `src/` — import trỏ thẳng tới file thật (`docs/convention/coding-style-conventions.md` §3).
- Trong `src/**` (trừ `.spec.ts`), import luôn dùng relative — không bao giờ `@src/...` (alias đó chỉ dùng cho test). Xem `docs/convention/coding-style-conventions.md` §4.
- Không dùng `any` — dùng `unknown` + type guard hoặc interface phù hợp nếu 1 lib thiếu type (`docs/convention/coding-style-conventions.md` §5).
- Không wire Redis vào bất kỳ feature nào của app (throttler, cache) trong phase này — service `redis` trong `docker-compose.yml` chỉ là container, app code chưa dùng tới.
- Không động vào Grafana/Loki/Prometheus-server, production deployment topology, hay bất kỳ module nghiệp vụ nào — ngoài phạm vi theo mục Non-goals của spec.

---

### Task 1: API versioning (`/api/v1`), Swagger ở `/docs`, sửa refresh-cookie path

**Files:**

- Modify: `src/bootstrap/configure-app.ts`
- Modify: `src/main.ts`
- Modify: `src/auth/auth.controller.ts:38` (constant `REFRESH_TOKEN_COOKIE_PATH`)
- Test: `test/auth-register.e2e-spec.ts` (thêm 1 assertion; file đã có, không tạo file mới)
- Test: `test/support/versioning.e2e-spec.ts` (mới)

**Interfaces:**

- Consumes: không phụ thuộc task nào khác.
- Produces: mọi route giờ nằm dưới `/api/v1/*`; e2e test của mọi task khác phải gọi `/api/v1/...`, không phải path trần.

- [ ] **Step 1: Viết e2e test cho versioning (fail trước)**

Tạo `test/support/versioning.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app.js';

describe('API versioning (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves auth routes under /api/v1/auth, not the unversioned path', async () => {
    const unversioned = await request(app.getHttpServer()).post('/auth/login').send({});
    expect(unversioned.status).toBe(404);

    const versioned = await request(app.getHttpServer()).post('/api/v1/auth/login').send({});
    expect(versioned.status).not.toBe(404);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Chạy: `npm run test:e2e -- versioning`
Kỳ vọng: FAIL — `/api/v1/auth/login` hiện đang 404 (versioning chưa wire).

- [ ] **Step 3: Wire global prefix + URI versioning vào `configureApp()`**

Sửa `src/bootstrap/configure-app.ts` — thêm versioning cạnh `ValidationPipe`/`cookie-parser` đã có, để `main.ts` và `create-test-app.ts` dùng chung:

```typescript
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppLogger } from '../common/app-logger.js';

export function configureApp(app: INestApplication) {
  app.useLogger(new AppLogger());

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use(cookieParser());
}
```

- [ ] **Step 4: Chuyển Swagger sang `/docs` trong `main.ts`**

Sửa `src/main.ts` — đổi lời gọi `SwaggerModule.setup`:

```typescript
SwaggerModule.setup('docs', app, document);
```

(Mọi thứ khác trong `main.ts` — `DocumentBuilder`, `configureApp(app)`, `app.listen(...)` — giữ nguyên.)

- [ ] **Step 5: Sửa path của refresh-token cookie**

Sửa `src/auth/auth.controller.ts:38` — `path` của cookie phải khớp route đã versioned, không thì browser sẽ không bao giờ gửi lại cookie ở `/api/v1/auth/refresh`:

```typescript
const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';
```

- [ ] **Step 6: Chạy lại e2e test versioning, xác nhận pass**

Chạy: `npm run test:e2e -- versioning`
Kỳ vọng: PASS

- [ ] **Step 7: Cập nhật các e2e spec hiện có sang path đã versioned**

Mọi file `test/*.e2e-spec.ts` gọi `request(app.getHttpServer()).post('/auth/...')` hoặc `.get('/auth/...')` phải đổi sang `/api/v1/auth/...`. Tìm hết các chỗ gọi:

Chạy: `grep -rn "'/auth" test/*.e2e-spec.ts`

Cập nhật từng path match (vd `'/auth/register'` → `'/api/v1/auth/register'`) ở: `test/app.e2e-spec.ts`, `test/auth-login.e2e-spec.ts`, `test/auth-register.e2e-spec.ts`, `test/auth-register-flow.e2e-spec.ts`, `test/auth-refresh.e2e-spec.ts`, `test/auth-logout.e2e-spec.ts`, `test/auth-verify-email.e2e-spec.ts`, `test/auth-resend-verification.e2e-spec.ts`, `test/auth-forgot-password.e2e-spec.ts`, `test/auth-reset-password.e2e-spec.ts`, `test/auth-rate-limiting.e2e-spec.ts`, `test/mail-smtp.e2e-spec.ts`. Chỉ thay đúng string literal prefix — không đụng gì khác trong các file này.

- [ ] **Step 8: Chạy toàn bộ e2e suite, xác nhận không regression**

Chạy: `npm run test:e2e`
Kỳ vọng: PASS — mọi e2e spec đều xanh.

- [ ] **Step 9: Commit**

```bash
git add src/bootstrap/configure-app.ts src/main.ts src/auth/auth.controller.ts test/
git commit -m "feat: version API under /api/v1, move Swagger to /docs (ADR 0002)"
```

---

### Task 2: Cột `authorization_version` (schema migration)

**Files:**

- Modify: `prisma/schema/schema.prisma` (thêm field vào `User`)
- Create: `prisma/migrations/<timestamp>_add_authorization_version/migration.sql` (Prisma CLI tự sinh, không viết tay)

**Interfaces:**

- Produces: `User.authorizationVersion: number` (tên field Prisma; cột DB `authorization_version INT NOT NULL DEFAULT 0`) — được Task 4 (JWT payload) và mọi endpoint đổi role/status tương lai (Phase 3, ngoài phạm vi ở đây) tiêu thụ.

- [ ] **Step 1: Thêm field vào Prisma schema**

Sửa `prisma/schema/schema.prisma` — trong `model User { ... }`, thêm field ngay sau `status`:

```prisma
model User {
  id                  String     @id @default(uuid()) @db.Uuid
  email               String     @unique @db.VarChar(255)
  passwordHash        String     @map("password_hash")
  fullName            String     @map("full_name") @db.VarChar(255)
  phone               String     @db.VarChar(30)
  status              UserStatus @default(ACTIVE)
  authorizationVersion Int       @default(0) @map("authorization_version")
  emailVerifiedAt     DateTime?  @map("email_verified_at") @db.Timestamptz(6)
  createdAt           DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt           DateTime   @updatedAt @map("updated_at") @db.Timestamptz(6)
  ...
```

(Chỉ thêm đúng 1 dòng mới — không reformat lại phần còn lại của model; `prisma format` sẽ tự căn lại cột ở step sau.)

- [ ] **Step 2: Generate migration**

Chạy: `npx prisma migrate dev --name add_authorization_version`
Kỳ vọng: tạo `prisma/migrations/<timestamp>_add_authorization_version/migration.sql` chứa `ALTER TABLE "users" ADD COLUMN "authorization_version" INTEGER NOT NULL DEFAULT 0;`, áp migration đó vào DB dev local, và generate lại `src/generated/prisma/`.

- [ ] **Step 3: Xác nhận generated client đã có field mới**

Chạy: `grep -rn "authorizationVersion" src/generated/prisma/models/User.ts`
Kỳ vọng: có match — xác nhận `prisma generate` đã nhận field mới.

- [ ] **Step 4: Chạy toàn bộ unit test suite (regression check — chưa đổi behavior gì)**

Chạy: `npm run test`
Kỳ vọng: PASS — step này chỉ thêm 1 cột có default; chưa ai đọc/ghi nó.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema/schema.prisma prisma/migrations/
git commit -m "feat: add users.authorization_version column"
```

---

### Task 3: Migrate role — rename `ADMIN` → `MASTER_ADMIN`, seed 4 role chuẩn

**Files:**

- Create: `prisma/migrations/<timestamp>_rename_admin_to_master_admin/migration.sql` (data migration viết tay — xem bên dưới)
- Modify: `prisma/seed.ts`
- Modify: `src/auth/guards/ownership.guard.ts:23`
- Modify: `src/auth/guards/ownership.guard.spec.ts:36-44`

**Interfaces:**

- Consumes: không phụ thuộc task nào khác (độc lập với schema migration ở Task 2, nhưng chạy sau nó để thứ tự folder migration sort đúng thứ tự áp dụng).
- Produces: role name `'MASTER_ADMIN'` (dòng DB, thay cho `'ADMIN'`), cộng 3 dòng role mới `'CUSTOMER'`, `'ORDER_STAFF'`, `'STORE_MANAGER'` (idempotent — `'CUSTOMER'` có thể đã tồn tại từ trước, `ON CONFLICT DO NOTHING` không được lỗi với nó).

- [ ] **Step 1: Tạo folder migration bằng tay (data migration, không phải schema diff)**

Chạy: `npx prisma migrate dev --create-only --name rename_admin_to_master_admin`
Kỳ vọng: tạo `prisma/migrations/<timestamp>_rename_admin_to_master_admin/migration.sql` rỗng, chưa apply gì (schema.prisma không có diff nào đang chờ, nên file sinh ra rỗng).

- [ ] **Step 2: Viết SQL cho data migration**

Thay nội dung file `migration.sql` (rỗng, vừa sinh) bằng:

```sql
-- Rename the legacy ADMIN role to the canonical MASTER_ADMIN (ADR 0005).
UPDATE "roles" SET "name" = 'MASTER_ADMIN' WHERE "name" = 'ADMIN';

-- Seed the remaining 3 canonical roles if they don't already exist.
INSERT INTO "roles" ("id", "name", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'CUSTOMER', now(), now()),
  (gen_random_uuid(), 'ORDER_STAFF', now(), now()),
  (gen_random_uuid(), 'STORE_MANAGER', now(), now()),
  (gen_random_uuid(), 'MASTER_ADMIN', now(), now())
ON CONFLICT ("name") DO NOTHING;
```

(Dòng `MASTER_ADMIN` cuối trong `INSERT` là lưới an toàn cho 1 DB mới hoàn toàn, chưa từng có dòng `ADMIN` để rename — `ON CONFLICT DO NOTHING` khiến cả 2 statement an toàn dù chạy theo thứ tự nào hoặc trên bảng rỗng.)

- [ ] **Step 3: Apply migration**

Chạy: `npx prisma migrate dev`
Kỳ vọng: apply migration mới vào DB dev local, không hỏi thêm gì (không còn schema diff nào đang chờ).

- [ ] **Step 4: Xác nhận bảng roles**

Chạy: `npx prisma studio` (hoặc `psql "$DATABASE_URL" -c "SELECT name FROM roles ORDER BY name;"`)
Kỳ vọng: đúng `CUSTOMER`, `MASTER_ADMIN`, `ORDER_STAFF`, `STORE_MANAGER` — không có dòng `ADMIN`.

- [ ] **Step 5: Cập nhật `prisma/seed.ts` dùng role name chuẩn**

Sửa `prisma/seed.ts` — upsert và log message:

```typescript
const adminRole = await prisma.role.upsert({
  where: { name: 'MASTER_ADMIN' },
  update: {},
  create: { name: 'MASTER_ADMIN' },
});
```

(Giữ nguyên tên env var `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD` — chúng đặt tên cho _tài khoản_ bootstrap, không phải role, đổi tên chúng là 1 việc đổi env var không liên quan, ngoài phạm vi task này.)

- [ ] **Step 6: Chạy lại seed, xác nhận idempotent với role name mới**

Chạy: `npm run db:seed`
Kỳ vọng: thành công, log ra `Created admin <email>.` hoặc `Admin <email> already exists, skipping.` — không lỗi về role bị thiếu/trùng.

- [ ] **Step 7: Viết unit test fail cho việc rename bypass của `OwnershipGuard`**

Sửa `src/auth/guards/ownership.guard.spec.ts` — cập nhật test đã có ở dòng 36 (không thêm test mới, đây là sửa lại test cũ):

```typescript
it('bypasses ownership check entirely for a user with the MASTER_ADMIN role, without calling fetch', async () => {
  const fetch = vi.fn();
  const { guard } = createGuard({ paramIdKey: 'id', fetch });

  await expect(
    guard.canActivate(createContext({ sub: 'admin-1', roles: ['MASTER_ADMIN'] }, { id: 'resource-1' })),
  ).resolves.toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});
```

- [ ] **Step 8: Chạy test, xác nhận fail**

Chạy: `npx vitest run src/auth/guards/ownership.guard.spec.ts`
Kỳ vọng: FAIL — `ownership.guard.ts` vẫn đang check `'ADMIN'`, nên user `['MASTER_ADMIN']` không được bypass và test rơi vào `fetch` (là `undefined` trong fixture này), throw lỗi.

- [ ] **Step 9: Sửa `OwnershipGuard`**

Sửa `src/auth/guards/ownership.guard.ts:23`:

```typescript
// MASTER_ADMIN bypass — không cần kiểm tra ownership.
if (user.roles.includes('MASTER_ADMIN')) return true;
```

- [ ] **Step 10: Chạy test, xác nhận pass**

Chạy: `npx vitest run src/auth/guards/ownership.guard.spec.ts`
Kỳ vọng: PASS

- [ ] **Step 11: Chạy toàn bộ unit + e2e suite**

Chạy: `npm run test && npm run test:e2e`
Kỳ vọng: PASS — fixture `'ADMIN'`/`'STAFF'` trong `roles.guard.spec.ts` chủ đích không đổi (nó test việc `RolesGuard` so khớp string chung với 1 giá trị `@Roles(...)` tuỳ ý, không phải role name thật — xem comment ở `roles.guard.ts:23-25`).

- [ ] **Step 12: Commit**

```bash
git add prisma/migrations/ prisma/seed.ts src/auth/guards/ownership.guard.ts src/auth/guards/ownership.guard.spec.ts
git commit -m "feat: migrate ADMIN role to canonical MASTER_ADMIN, seed 4 canonical roles (ADR 0005)"
```

---

### Task 4: Wire `authorizationVersion` vào JWT — issue và verify

**Files:**

- Modify: `src/auth/strategies/jwt.strategy.ts`
- Modify: `src/auth/services/auth.service.ts:460-467` (`signAccessToken`)
- Modify: `src/auth/services/auth.service.spec.ts:487,491,606,615` (assertion hiện có trên payload `jwtService.sign`)
- Test: `src/auth/strategies/jwt.strategy.spec.ts` (mới)

**Interfaces:**

- Consumes: `PrismaService` (đã injectable ở mọi nơi), `User.authorizationVersion` từ Task 2.
- Produces: `JwtPayload` giờ có field bắt buộc `authorizationVersion: number` — mọi nơi khác dựng object `JwtPayload` (fixture test ở `roles.guard.spec.ts`, `ownership.guard.spec.ts`, nơi dùng `current-user.decorator.ts`) phải thêm field này khi task này xong, nếu không TypeScript sẽ fail compile.

- [ ] **Step 1: Cập nhật interface `JwtPayload` và thêm validate dựa trên DB**

Sửa `src/auth/strategies/jwt.strategy.ts` — đây là thay đổi behavior lớn nhất trong task này: `validate()` hiện đang tin token vô điều kiện; giờ phải re-check `authorizationVersion` đối chiếu DB ở mọi request, theo đúng Mục 13 ("request được bảo vệ phải khớp với version hiện tại; authorization đặc quyền fail closed khi không thể xác minh version"):

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  roles: string[]; // tên role, vd ['CUSTOMER'] hoặc ['MASTER_ADMIN'] — không hardcode enum (quyết định #6)
  authorizationVersion: number; // phải khớp users.authorization_version hiện tại — Mục 13
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Được Passport gọi SAU KHI đã verify chữ ký + hạn JWT thành công. Kiểm
   * tra thêm authorizationVersion khớp DB hiện tại — nếu user bị đổi
   * role/status sau khi token được cấp, authorizationVersion trong DB tăng
   * lên và token cũ (mang version cũ) bị reject ngay, không cần chờ hết
   * hạn (Mục 13). Fail closed: không tìm thấy user hoặc lệch version → 401.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { authorizationVersion: true },
    });
    if (!user || user.authorizationVersion !== payload.authorizationVersion) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
```

- [ ] **Step 2: Viết unit test fail cho strategy**

Tạo `src/auth/strategies/jwt.strategy.spec.ts`:

```typescript
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy.js';
import { PrismaService } from '../../prisma/prisma.service.js';

function createStrategy(userAuthorizationVersion: number | null) {
  const config = { getOrThrow: () => 'test-secret' } as unknown as ConfigService;
  const prisma = {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          userAuthorizationVersion === null ? null : { authorizationVersion: userAuthorizationVersion },
        ),
    },
  } as unknown as PrismaService;
  return new JwtStrategy(config, prisma);
}

describe('JwtStrategy', () => {
  it('accepts a payload whose authorizationVersion matches the current DB value', async () => {
    const strategy = createStrategy(2);
    const payload = { sub: 'user-1', email: 'user@example.com', roles: ['CUSTOMER'], authorizationVersion: 2 };

    await expect(strategy.validate(payload)).resolves.toBe(payload);
  });

  it('rejects a payload whose authorizationVersion is stale', async () => {
    const strategy = createStrategy(3);
    const payload = { sub: 'user-1', email: 'user@example.com', roles: ['CUSTOMER'], authorizationVersion: 2 };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a payload for a user that no longer exists', async () => {
    const strategy = createStrategy(null);
    const payload = { sub: 'deleted-user', email: 'gone@example.com', roles: ['CUSTOMER'], authorizationVersion: 0 };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận hiện tại nó fail (hoặc pass nếu đã áp Step 1)**

Chạy: `npx vitest run src/auth/strategies/jwt.strategy.spec.ts`
Kỳ vọng: FAIL (test này viết theo code ở Step 1, nên chạy bước này _sau_ Step 1 — nếu theo đúng TDD nghiêm ngặt, áp edit của Step 1 trước, thì lần chạy này chỉ để xác nhận không regression: nó phải PASS ngay khi Step 1 đã được áp; nếu không PASS thì edit ở strategy đang có bug).

- [ ] **Step 4: Cập nhật `signAccessToken` để nhúng `authorizationVersion` vào JWT phát ra**

Sửa `src/auth/services/auth.service.ts:460-467`:

```typescript
  private signAccessToken(user: {
    id: string;
    email: string;
    authorizationVersion: number;
    userRoles: { role: { name: string } }[];
  }): {
    accessToken: string;
    roles: string[];
  } {
    const roles = user.userRoles.map((ur) => ur.role.name);
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      roles,
      authorizationVersion: user.authorizationVersion,
    });
    return { accessToken, roles };
  }
```

Mọi nơi gọi `signAccessToken(user)` (trong `login()` và `refreshToken()`) đều đã truyền sẵn record Prisma `user` đầy đủ vừa fetch — vì `authorizationVersion` giờ đã có trên record đó (Task 2), không caller nào cần sửa, chỉ có kiểu tham số được nới rộng. Xác nhận cả 2 call site vẫn typecheck được:

Chạy: `npm run typecheck`
Kỳ vọng: PASS. Nếu fail, `select`/`include` Prisma của caller đang thiếu `authorizationVersion` — kiểm tra query và thêm nó vào `select` giống cách `status`/`emailVerifiedAt` đã được select ở đó.

- [ ] **Step 5: Cập nhật assertion hiện có trong `auth.service.spec.ts`**

Sửa `src/auth/services/auth.service.spec.ts` — dòng 487/491 và 606/615 assert đúng object truyền vào `jwtService.sign`. Tìm fixture user mock mà 2 test này dùng (search object literal hiện đang thiếu `authorizationVersion`) và thêm `authorizationVersion: 0` vào đó, rồi cập nhật 2 assertion:

```typescript
expect(jwtService.sign).toHaveBeenCalledWith({
  sub: 'user-1',
  email: 'user@example.com',
  roles: ['CUSTOMER'],
  authorizationVersion: 0,
});
```

(Áp đúng thay đổi này ở cả dòng ~491 và ~615 — cùng shape, cùng giá trị fixture.)

- [ ] **Step 6: Sửa các fixture test dạng `JwtPayload` khác đang fail compile**

Chạy: `npm run typecheck`
Kỳ vọng: liệt kê mọi fixture object đang thiếu `authorizationVersion`. Vị trí đã biết từ lúc khảo sát codebase khi lập plan: `src/auth/guards/roles.guard.spec.ts` (`createContext({ sub: 'user-1', roles: ['ADMIN'] })`) và `src/auth/guards/ownership.guard.spec.ts` (đã sửa ở Task 3, nhưng re-check lại). Thêm `authorizationVersion: 0` vào mọi object literal như vậy cho tới khi `typecheck` sạch.

- [ ] **Step 7: Chạy toàn bộ unit test suite**

Chạy: `npm run test`
Kỳ vọng: PASS

- [ ] **Step 8: Chạy toàn bộ e2e suite**

Chạy: `npm run test:e2e`
Kỳ vọng: PASS — e2e spec login/refresh chạy `JwtStrategy` thật đối chiếu DB test thật, nên đây là tín hiệu mạnh nhất rằng việc issue và verify field payload mới hoạt động đúng end-to-end.

- [ ] **Step 9: Commit**

```bash
git add src/auth/strategies/jwt.strategy.ts src/auth/strategies/jwt.strategy.spec.ts src/auth/services/auth.service.ts src/auth/services/auth.service.spec.ts src/auth/guards/roles.guard.spec.ts
git commit -m "feat: verify authorizationVersion on every request, fail closed on mismatch (Mục 13)"
```

---

### Task 5: Health check (`/health/live`, `/health/ready`) + graceful shutdown

**Files:**

- Create: `src/health/health.module.ts`
- Create: `src/health/health.controller.ts`
- Create: `src/health/prisma-health.indicator.ts`
- Create: `test/health.e2e-spec.ts`
- Modify: `src/app.module.ts` (import `HealthModule`)
- Modify: `src/main.ts` (`app.enableShutdownHooks()`)

**Interfaces:**

- Consumes: `PrismaService` (đã có sẵn).
- Produces: `GET /api/v1/health/live` → `200`; `GET /api/v1/health/ready` → `200`/`503` tuỳ Postgres còn reachable hay không. Chưa có gì phía sau phụ thuộc vào đây (Phase 1 là consumer đầu tiên của Terminus trong repo này).

- [ ] **Step 1: Cài `@nestjs/terminus`**

Chạy: `npm install @nestjs/terminus`
Kỳ vọng: được thêm vào `dependencies` trong `package.json`.

- [ ] **Step 2: Viết custom Prisma health indicator**

Tạo `src/health/prisma-health.indicator.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * ADR 0008: readiness chỉ phụ thuộc Postgres — Redis down không bao giờ
 * được đưa vào đây, dù sau này app có dùng Redis cho feature khác.
 */
@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return indicator.up();
    } catch (err) {
      return indicator.down({ message: (err as Error).message });
    }
  }
}
```

- [ ] **Step 3: Viết health controller**

Tạo `src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma-health.indicator.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  // Luôn 200 nếu process còn nhận request — không check dependency nào.
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  // Chỉ phụ thuộc Postgres (ADR 0008) — Redis down không làm route này 503.
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.prismaHealth.isHealthy('postgres')]);
  }
}
```

- [ ] **Step 4: Viết health module**

Tạo `src/health/health.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { PrismaHealthIndicator } from './prisma-health.indicator.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
})
export class HealthModule {}
```

- [ ] **Step 5: Đăng ký `HealthModule` vào `AppModule`**

Sửa `src/app.module.ts` — thêm import:

```typescript
import { HealthModule } from './health/health.module.js';
```

và thêm `HealthModule` vào array `imports: [...]` (cạnh `PrismaModule`, `AuthModule`).

- [ ] **Step 6: Viết e2e test fail trước**

Tạo `test/health.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { createTestApp } from './support/create-test-app.js';

describe('Health checks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live always returns 200', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/v1/health/ready returns 200 when Postgres is reachable', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/health/ready returns 503 when Postgres is unreachable', async () => {
    const spy = vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    expect(res.status).toBe(503);

    spy.mockRestore();
  });
});
```

- [ ] **Step 7: Chạy test, xem hiện trạng**

Chạy: `npm run test:e2e -- health`
Kỳ vọng: nếu Step 1-5 đã làm đúng, cả 3 test đều PASS luôn (task này không strict red-green vì controller được viết trước test) — coi bất kỳ FAIL nào ở đây là bug ở Step 2-5, sửa ngay, không để lại.

- [ ] **Step 8: Bật graceful shutdown**

Sửa `src/main.ts` — thêm 1 dòng sau `configureApp(app)`:

```typescript
configureApp(app);
app.enableShutdownHooks();
```

(Điều này khiến Nest gọi `PrismaService.onModuleDestroy()` — đã implement sẵn, `await this.$disconnect()` — khi nhận `SIGTERM`/`SIGINT`, để connection pool đóng sạch thay vì bị kill giữa lúc đang query trong 1 lượt rolling deploy.)

- [ ] **Step 9: Chạy toàn bộ e2e suite**

Chạy: `npm run test:e2e`
Kỳ vọng: PASS

- [ ] **Step 10: Commit**

```bash
git add src/health/ src/app.module.ts src/main.ts test/health.e2e-spec.ts package.json package-lock.json
git commit -m "feat: add /health/live and /health/ready (ADR 0008), enable graceful shutdown"
```

---

### Task 6: Prometheus metrics cơ bản (`GET /metrics`)

**Files:**

- Create: `src/metrics/metrics.module.ts`
- Create: `src/metrics/metrics.controller.ts`
- Create: `src/metrics/metrics.interceptor.ts`
- Create: `test/metrics.e2e-spec.ts`
- Modify: `src/app.module.ts` (import `MetricsModule`, đăng ký interceptor làm `APP_INTERCEPTOR`)

**Interfaces:**

- Consumes: không phụ thuộc task nào khác.
- Produces: `GET /metrics` (chú ý: **không** nằm dưới `/api/v1` — convention scrape của Prometheus là path trần `/metrics`) trả text theo Prometheus exposition format. Không có task nào khác tiêu thụ output này.

- [ ] **Step 1: Cài `prom-client`**

Chạy: `npm install prom-client`

- [ ] **Step 2: Viết metrics interceptor**

Tạo `src/metrics/metrics.interceptor.ts`:

```typescript
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const start = process.hrtime.bigint();
    const route = request.route?.path ?? request.url;

    return next.handle().pipe(
      tap(() => {
        const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
        const labels = { method: request.method, route, status_code: String(response.statusCode) };
        httpRequestsTotal.inc(labels);
        httpRequestDurationSeconds.observe(labels, durationSeconds);
      }),
    );
  }
}
```

- [ ] **Step 3: Viết metrics controller**

Tạo `src/metrics/metrics.controller.ts`:

```typescript
import { Controller, Get, Header } from '@nestjs/common';
import { register } from 'prom-client';

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', register.contentType)
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
```

- [ ] **Step 4: Viết metrics module**

Tạo `src/metrics/metrics.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller.js';
import { MetricsInterceptor } from './metrics.interceptor.js';

@Module({
  controllers: [MetricsController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class MetricsModule {}
```

- [ ] **Step 5: Đăng ký `MetricsModule` vào `AppModule`**

Sửa `src/app.module.ts` — thêm import và thêm `MetricsModule` vào `imports: [...]`. (Không cần sửa provider gì ở cấp `AppModule` — `MetricsModule` tự đăng ký `APP_INTERCEPTOR` của nó.)

- [ ] **Step 6: Ghi chú — route `/metrics` không versioned/không prefix**

Vì `MetricsController` dùng `@Controller('metrics')` và global prefix (`app.setGlobalPrefix('api')` từ Task 1) mặc định áp cho _mọi_ controller, `/metrics` sẽ vô tình thành `/api/metrics`. Convention scrape của Prometheus cần path trần `/metrics`. Loại nó khỏi global prefix — sửa `src/bootstrap/configure-app.ts`:

```typescript
app.setGlobalPrefix('api', { exclude: ['metrics'] });
```

- [ ] **Step 7: Viết e2e test fail trước**

Tạo `test/metrics.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/create-test-app.js';

describe('Metrics (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /metrics exposes request counters after handling a request', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/live');

    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds');
  });
});
```

- [ ] **Step 8: Chạy test**

Chạy: `npm run test:e2e -- metrics`
Kỳ vọng: PASS (giống Task 5 Step 7 — implementation đi trước test ở đây; coi FAIL là bug ở Step 2-6, sửa ngay).

- [ ] **Step 9: Chạy toàn bộ e2e suite, xác nhận `exclude: ['metrics']` không làm gãy gì khác**

Chạy: `npm run test:e2e`
Kỳ vọng: PASS

- [ ] **Step 10: Commit**

```bash
git add src/metrics/ src/bootstrap/configure-app.ts src/app.module.ts test/metrics.e2e-spec.ts package.json package-lock.json
git commit -m "feat: add baseline Prometheus metrics at GET /metrics"
```

---

### Task 7: `Dockerfile` + `.dockerignore`

**Files:**

- Create: `Dockerfile`
- Create: `.dockerignore`

**Interfaces:**

- Consumes: không phụ thuộc gì (standalone).
- Produces: 1 image build được, tag local là `nestjs-demo:local` — được `docker-compose.yml` ở Task 8 (`build: .`) và build step CI ở Task 9 tiêu thụ.

- [ ] **Step 1: Viết `.dockerignore`**

Tạo `.dockerignore`:

```text
node_modules
dist
generated
.git
.env
*.md
docs
doc
test
coverage
```

- [ ] **Step 2: Viết multi-stage `Dockerfile`**

Tạo `Dockerfile`:

```dockerfile
# Stage 1: build — full devDependencies, compile TS, generate Prisma client.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate --schema prisma/schema
RUN npm run build

# Stage 2: runtime — production dependencies only, no source/TS toolchain.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

- [ ] **Step 3: Build image**

Chạy: `docker build -t nestjs-demo:local .`
Kỳ vọng: build thành công, kết thúc bằng `naming to docker.io/library/nestjs-demo:local`.

- [ ] **Step 4: Sanity-check image chạy được (sẽ fail nhanh khi thiếu env var — đúng như kỳ vọng)**

Chạy: `docker run --rm nestjs-demo:local`
Kỳ vọng: process exit non-zero với lỗi nhắc thiếu `DATABASE_URL`/`JWT_ACCESS_SECRET`/v.v — điều này xác nhận đúng cơ chế fail-fast env validation (`src/config/env.validation.ts`) chạy đúng trong container. Đây là failure mode đúng/kỳ vọng khi chạy standalone; setup Compose ở Task 8 sẽ cấp env var thật.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add multi-stage Dockerfile for production image"
```

---

### Task 8: `docker-compose.yml` cho local development

**Files:**

- Create: `docker-compose.yml`

**Interfaces:**

- Consumes: `Dockerfile` từ Task 7.
- Produces: 1 stack local 3 container (`api`, `postgres`, `redis`) — `redis` chưa được app code dùng trong phase này (Global Constraints), chỉ để sẵn để các phase sau không cần sửa Compose khi cần dùng tới.

- [ ] **Step 1: Viết `docker-compose.yml`**

Tạo `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: nestjs_demo
      POSTGRES_PASSWORD: nestjs_demo
      POSTGRES_DB: nestjs_demo
    ports:
      - '5432:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U nestjs_demo']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:8-alpine
    ports:
      - '6379:6379'

  api:
    build: .
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://nestjs_demo:nestjs_demo@postgres:5432/nestjs_demo
      JWT_ACCESS_SECRET: local-dev-secret-change-me-32-chars-min
      ADMIN_BOOTSTRAP_EMAIL: admin@example.com
      ADMIN_BOOTSTRAP_PASSWORD: ChangeMe123!
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres-data:
```

- [ ] **Step 2: Đưa stack lên**

Chạy: `docker compose up --build -d`
Kỳ vọng: cả 3 container start; `docker compose ps` hiện `postgres` là `healthy`.

- [ ] **Step 3: Apply migration vào Postgres của Compose, rồi verify readiness**

Chạy: `docker compose exec api npx prisma migrate deploy`
Kỳ vọng: mọi migration từ Task 2-3 apply sạch vào Postgres Compose vừa tạo.

Chạy: `curl -i http://localhost:3000/api/v1/health/ready`
Kỳ vọng: `HTTP/1.1 200 OK`.

- [ ] **Step 4: Tear down**

Chạy: `docker compose down -v`
Kỳ vọng: container và volume bị xoá sạch.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose.yml for local dev (postgres, redis, api)"
```

---

### Task 9: CI — GitHub Actions

**Files:**

- Create: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: `Dockerfile` từ Task 7 (build job), toàn bộ test suite từ Task 1-6.
- Produces: 1 required status check trên mọi PR vào `master`.

- [ ] **Step 1: Viết workflow**

Tạo `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [master]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx prisma generate --schema prisma/schema
      - run: npm run typecheck

  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx prisma generate --schema prisma/schema
      - run: npm run test

  e2e-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: nestjs_demo
          POSTGRES_PASSWORD: nestjs_demo
          POSTGRES_DB: nestjs_demo
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U nestjs_demo"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://nestjs_demo:nestjs_demo@localhost:5432/nestjs_demo
      JWT_ACCESS_SECRET: ci-test-secret-at-least-32-characters-long
      ADMIN_BOOTSTRAP_EMAIL: admin@example.com
      ADMIN_BOOTSTRAP_PASSWORD: ChangeMe123!
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run test:e2e

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, unit-test, e2e-test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx prisma generate --schema prisma/schema
      - run: npm run build
      - run: docker build -t nestjs-demo:ci .
```

- [ ] **Step 2: Push branch, mở PR để trigger workflow**

Chạy: `git push -u origin HEAD`

Sau đó mở PR (hoặc push vào branch PR đã có) để `pull_request` trigger.

- [ ] **Step 3: Theo dõi run**

Chạy: `gh run watch` (sau khi push trigger 1 run — chạy `gh run list` trước nếu cần run ID)
Kỳ vọng: cả 5 job (`lint`, `typecheck`, `unit-test`, `e2e-test`, `build`) đều thành công.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow (lint, typecheck, unit+e2e test, build)"
```

---

## Final Verification Checklist

Chạy qua checklist này sau khi cả 9 task đã commit, tốt nhất trên 1 clean clone:

- [ ] `npm run lint` — pass
- [ ] `npm run typecheck` — pass
- [ ] `npm run test` — toàn bộ unit test pass
- [ ] `npm run test:e2e` — toàn bộ e2e test pass, kể cả `versioning`, `health`, `metrics`
- [ ] `curl http://localhost:3000/auth/login` (path chưa versioned, app chạy local) → `404`
- [ ] `curl http://localhost:3000/api/v1/health/live` → `200 {"status":"ok"}`
- [ ] `curl http://localhost:3000/api/v1/health/ready` → `200` (Postgres up), `503` khi Postgres bị stop
- [ ] `curl http://localhost:3000/metrics` → Prometheus exposition text chứa `http_requests_total`
- [ ] `curl http://localhost:3000/docs` → Swagger UI load được
- [ ] `docker compose up --build` → cả 3 service start, `api` đạt `ready`
- [ ] GitHub Actions CI xanh trên PR
- [ ] `SELECT name FROM roles` → `CUSTOMER`, `ORDER_STAFF`, `STORE_MANAGER`, `MASTER_ADMIN` (không có `ADMIN`)
- [ ] 1 user login → đổi role (thao tác tay qua `psql`, tăng `authorization_version`) → access token cũ nhận `401` ở bất kỳ route protected nào
- [ ] Không có folder mới nào dưới `src/` cho bất kỳ module nghiệp vụ nào (`products/`, `users/`, `cart/`, v.v) — chỉ `src/health/` và `src/metrics/` được thêm
