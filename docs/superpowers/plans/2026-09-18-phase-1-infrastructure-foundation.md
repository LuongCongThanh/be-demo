# Phase 1 — Infrastructure Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the runtime to `/api/v1/*` + `/docs`, migrate roles to the 4 canonical roles with a working `authorization_version` revocation mechanism, add health checks + graceful shutdown, add baseline Prometheus metrics, and add local Docker/Compose + CI — the 6 prerequisites in Mục 22 Phase 1 of `doc/ecommerce-backend-architecture-system-design-2.md` that every later phase (Categories, Products, ...) depends on.

**Architecture:** Purely additive to the existing NestJS modular-monolith layout — no existing file moves, no new top-level business-module folders (Mục 3's tree is the end-state across all 9 phases, not a Phase 1 checklist). Two new infra modules (`src/health/`, `src/metrics/`) sit flat under `src/`, next to `src/mail/`/`src/prisma/`. Versioning/shutdown config lives in the shared `configureApp()` (already used by both `main.ts` and `test/support/create-test-app.ts`, so e2e tests exercise the same config as production).

**Tech Stack:** NestJS 12, Prisma 7 (`@prisma/adapter-pg`), `@nestjs/terminus` (health), `prom-client` (metrics), Docker + Docker Compose, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-18-phase-1-infrastructure-foundation-design.md`

## Global Constraints

- No new top-level business-module folders (`products/`, `users/`, `cart/`, `orders/`, `inventory/`, `payments/`, `promotions/`) — those are created in their own phase (Mục 22), not here.
- No barrel files (`index.ts`) anywhere in `src/` — direct file imports only (`docs/convention/coding-style-conventions.md` §3).
- Inside `src/**` (except `.spec.ts`), imports are always relative — never `@src/...` (that alias is test-only). See `docs/convention/coding-style-conventions.md` §4.
- No `any` — use `unknown` + type guards or a proper interface if a library lacks types (`docs/convention/coding-style-conventions.md` §5).
- Do not wire Redis into any app feature (throttler, cache) in this phase — the `redis` service in `docker-compose.yml` is a container only, unused by app code.
- Do not touch Grafana/Loki/Prometheus-server, production deployment topology, or any business module — out of scope per the spec's Non-goals section.

---

### Task 1: API versioning (`/api/v1`), Swagger at `/docs`, fix refresh-cookie path

**Files:**

- Modify: `src/bootstrap/configure-app.ts`
- Modify: `src/main.ts`
- Modify: `src/auth/auth.controller.ts:38` (the `REFRESH_TOKEN_COOKIE_PATH` constant)
- Test: `test/auth-register.e2e-spec.ts` (add one assertion; existing file, no new file)
- Test: `test/support/versioning.e2e-spec.ts` (new)

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: every route now lives under `/api/v1/*`; every other task's e2e tests must call `/api/v1/...`, not the bare path.

- [ ] **Step 1: Write the failing e2e test for versioning**

Create `test/support/versioning.e2e-spec.ts`:

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

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm run test:e2e -- versioning`
Expected: FAIL — `/api/v1/auth/login` currently 404s (versioning not wired yet).

- [ ] **Step 3: Wire global prefix + URI versioning into `configureApp()`**

Edit `src/bootstrap/configure-app.ts` — add versioning next to the existing `ValidationPipe`/`cookie-parser` setup so `main.ts` and `create-test-app.ts` share it:

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

- [ ] **Step 4: Move Swagger to `/docs` in `main.ts`**

Edit `src/main.ts` — change the `SwaggerModule.setup` call:

```typescript
SwaggerModule.setup('docs', app, document);
```

(Everything else in `main.ts` — `DocumentBuilder`, `configureApp(app)`, `app.listen(...)` — stays as-is.)

- [ ] **Step 5: Fix the refresh-token cookie path**

Edit `src/auth/auth.controller.ts:38` — the cookie's `path` must match the new versioned route or the browser will never send it back on `/api/v1/auth/refresh`:

```typescript
const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';
```

- [ ] **Step 6: Run the versioning e2e test to confirm it passes**

Run: `npm run test:e2e -- versioning`
Expected: PASS

- [ ] **Step 7: Update the existing auth e2e specs to call the versioned path**

Every file under `test/*.e2e-spec.ts` that calls `request(app.getHttpServer()).post('/auth/...')` or `.get('/auth/...')` must be updated to `/api/v1/auth/...`. Find every call site:

Run: `grep -rn "'/auth" test/*.e2e-spec.ts`

Update each match's path string (e.g. `'/auth/register'` → `'/api/v1/auth/register'`) in: `test/app.e2e-spec.ts`, `test/auth-login.e2e-spec.ts`, `test/auth-register.e2e-spec.ts`, `test/auth-register-flow.e2e-spec.ts`, `test/auth-refresh.e2e-spec.ts`, `test/auth-logout.e2e-spec.ts`, `test/auth-verify-email.e2e-spec.ts`, `test/auth-resend-verification.e2e-spec.ts`, `test/auth-forgot-password.e2e-spec.ts`, `test/auth-reset-password.e2e-spec.ts`, `test/auth-rate-limiting.e2e-spec.ts`, `test/mail-smtp.e2e-spec.ts`. Do a plain string replace of the literal path prefix only — do not touch anything else in these files.

- [ ] **Step 8: Run the full e2e suite to confirm nothing regressed**

Run: `npm run test:e2e`
Expected: PASS — every e2e spec green.

- [ ] **Step 9: Commit**

```bash
git add src/bootstrap/configure-app.ts src/main.ts src/auth/auth.controller.ts test/
git commit -m "feat: version API under /api/v1, move Swagger to /docs (ADR 0002)"
```

---

### Task 2: `authorization_version` column (schema migration)

**Files:**

- Modify: `prisma/schema/schema.prisma` (add field to `User`)
- Create: `prisma/migrations/<timestamp>_add_authorization_version/migration.sql` (generated by Prisma CLI, not hand-written)

**Interfaces:**

- Produces: `User.authorizationVersion: number` (Prisma field name; DB column `authorization_version INT NOT NULL DEFAULT 0`) — consumed by Task 4 (JWT payload) and by every future role/status-changing endpoint (Phase 3, out of scope here).

- [ ] **Step 1: Add the field to the Prisma schema**

Edit `prisma/schema/schema.prisma` — inside `model User { ... }`, add the field right after `status`:

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

(Only the one new line — do not reformat the rest of the model; `prisma format` will realign columns automatically in the next step.)

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name add_authorization_version`
Expected: creates `prisma/migrations/<timestamp>_add_authorization_version/migration.sql` containing `ALTER TABLE "users" ADD COLUMN "authorization_version" INTEGER NOT NULL DEFAULT 0;`, applies it to your local dev DB, and regenerates `src/generated/prisma/`.

- [ ] **Step 3: Verify the generated client has the new field**

Run: `grep -rn "authorizationVersion" src/generated/prisma/models/User.ts`
Expected: a match — confirms `prisma generate` picked up the new field.

- [ ] **Step 4: Run the full unit test suite (regression check — no behavior changed yet)**

Run: `npm run test`
Expected: PASS — this step only added a column with a default; nothing reads or writes it yet.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema/schema.prisma prisma/migrations/
git commit -m "feat: add users.authorization_version column"
```

---

### Task 3: Role migration — rename `ADMIN` → `MASTER_ADMIN`, seed the 4 canonical roles

**Files:**

- Create: `prisma/migrations/<timestamp>_rename_admin_to_master_admin/migration.sql` (hand-written data migration — see below)
- Modify: `prisma/seed.ts`
- Modify: `src/auth/guards/ownership.guard.ts:23`
- Modify: `src/auth/guards/ownership.guard.spec.ts:36-44`

**Interfaces:**

- Consumes: nothing from other tasks (independent of Task 2's schema migration, but run after it so migration folders sort in the applied order).
- Produces: role name `'MASTER_ADMIN'` (DB row, replacing `'ADMIN'`), plus 3 new role rows `'CUSTOMER'`, `'ORDER_STAFF'`, `'STORE_MANAGER'` (idempotent — `'CUSTOMER'` already exists from earlier work, `ON CONFLICT DO NOTHING` must not error on it).

- [ ] **Step 1: Create the migration folder by hand (data migration, not a schema diff)**

Run: `npx prisma migrate dev --create-only --name rename_admin_to_master_admin`
Expected: creates an empty `prisma/migrations/<timestamp>_rename_admin_to_master_admin/migration.sql` without applying anything (schema.prisma has no pending diff, so the generated file is empty).

- [ ] **Step 2: Write the data migration SQL**

Replace the contents of the generated (empty) `migration.sql` with:

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

(The last `MASTER_ADMIN` row in the `INSERT` is a safety net for a fresh DB that never had an `ADMIN` row to rename — `ON CONFLICT DO NOTHING` makes both statements safe to run in either order or on an empty table.)

- [ ] **Step 3: Apply the migration**

Run: `npx prisma migrate dev`
Expected: applies the new migration to your local dev DB with no further prompts (no pending schema diff).

- [ ] **Step 4: Verify the roles table**

Run: `npx prisma studio` (or `psql "$DATABASE_URL" -c "SELECT name FROM roles ORDER BY name;"`)
Expected: exactly `CUSTOMER`, `MASTER_ADMIN`, `ORDER_STAFF`, `STORE_MANAGER` — no `ADMIN` row.

- [ ] **Step 5: Update `prisma/seed.ts` to use the canonical role name**

Edit `prisma/seed.ts` — the upsert and the log message:

```typescript
const adminRole = await prisma.role.upsert({
  where: { name: 'MASTER_ADMIN' },
  update: {},
  create: { name: 'MASTER_ADMIN' },
});
```

(Leave `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD` env var names as-is — those name the bootstrap _account_, not a role, and renaming them would be an unrelated env-var churn outside this task's scope.)

- [ ] **Step 6: Re-run the seed to confirm it's idempotent against the new role name**

Run: `npm run db:seed`
Expected: succeeds, logs either `Created admin <email>.` or `Admin <email> already exists, skipping.` — no error about a missing/duplicate role.

- [ ] **Step 7: Write the failing unit test for the `OwnershipGuard` bypass rename**

Edit `src/auth/guards/ownership.guard.spec.ts` — update the existing test at line 36 (do not add a new test, this one is being corrected):

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

- [ ] **Step 8: Run the test to confirm it fails**

Run: `npx vitest run src/auth/guards/ownership.guard.spec.ts`
Expected: FAIL — `ownership.guard.ts` still checks for `'ADMIN'`, so a `['MASTER_ADMIN']` user is not bypassed and the test hits `fetch` (which is `undefined` in this fixture), throwing.

- [ ] **Step 9: Fix `OwnershipGuard`**

Edit `src/auth/guards/ownership.guard.ts:23`:

```typescript
// MASTER_ADMIN bypass — không cần kiểm tra ownership.
if (user.roles.includes('MASTER_ADMIN')) return true;
```

- [ ] **Step 10: Run the test to confirm it passes**

Run: `npx vitest run src/auth/guards/ownership.guard.spec.ts`
Expected: PASS

- [ ] **Step 11: Run the full unit + e2e suites**

Run: `npm run test && npm run test:e2e`
Expected: PASS — `roles.guard.spec.ts`'s `'ADMIN'`/`'STAFF'` fixtures are untouched deliberately (they test `RolesGuard`'s generic string-matching against an arbitrary `@Roles(...)` decorator value, not a real role name — see the comment at `roles.guard.ts:23-25`).

- [ ] **Step 12: Commit**

```bash
git add prisma/migrations/ prisma/seed.ts src/auth/guards/ownership.guard.ts src/auth/guards/ownership.guard.spec.ts
git commit -m "feat: migrate ADMIN role to canonical MASTER_ADMIN, seed 4 canonical roles (ADR 0005)"
```

---

### Task 4: Wire `authorizationVersion` into the JWT — issue and verify

**Files:**

- Modify: `src/auth/strategies/jwt.strategy.ts`
- Modify: `src/auth/services/auth.service.ts:460-467` (`signAccessToken`)
- Modify: `src/auth/services/auth.service.spec.ts:487,491,606,615` (existing assertions on `jwtService.sign` payload)
- Test: `src/auth/strategies/jwt.strategy.spec.ts` (new)

**Interfaces:**

- Consumes: `PrismaService` (already injectable everywhere), `User.authorizationVersion` from Task 2.
- Produces: `JwtPayload` now has a required `authorizationVersion: number` field — every other place that constructs a `JwtPayload` object (test fixtures in `roles.guard.spec.ts`, `ownership.guard.spec.ts`, `current-user.decorator.ts` consumers) must include it once this task lands, or TypeScript will fail to compile.

- [ ] **Step 1: Update the `JwtPayload` interface and add DB-backed validation**

Edit `src/auth/strategies/jwt.strategy.ts` — this is the biggest behavior change in this task: `validate()` currently trusts the token blindly; it now must re-check `authorizationVersion` against the DB on every request, per Mục 13 ("request được bảo vệ phải khớp với version hiện tại; authorization đặc quyền fail closed khi không thể xác minh version"):

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

- [ ] **Step 2: Write the failing unit test for the strategy**

Create `src/auth/strategies/jwt.strategy.spec.ts`:

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

- [ ] **Step 3: Run the test to confirm it currently fails to even compile/pass**

Run: `npx vitest run src/auth/strategies/jwt.strategy.spec.ts`
Expected: FAIL (this test is written against the Step 1 code, so run this _after_ Step 1 — if you're following strict TDD, apply Step 1's edit first, then this becomes a regression-proving run: it should already PASS once Step 1 is in place; if it doesn't, the strategy edit has a bug).

- [ ] **Step 4: Update `signAccessToken` to include `authorizationVersion` in the issued JWT**

Edit `src/auth/services/auth.service.ts:460-467`:

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

Every caller of `signAccessToken(user)` (in `login()` and `refreshToken()`) already passes the full Prisma `user` record it just fetched — since `authorizationVersion` now exists on that record (Task 2), no caller needs to change, only the parameter type widened. Confirm both call sites still type-check:

Run: `npm run typecheck`
Expected: PASS. If it fails, the caller's Prisma `select`/`include` is missing `authorizationVersion` — check the query and add it to the `select` clause the same way `status`/`emailVerifiedAt` are already selected there.

- [ ] **Step 5: Update the existing `auth.service.spec.ts` assertions**

Edit `src/auth/services/auth.service.spec.ts` — lines 487/491 and 606/615 assert the exact object passed to `jwtService.sign`. Find the mock user fixture used by these two tests (search for the fixture object literal that currently omits `authorizationVersion`) and add `authorizationVersion: 0` to it, then update the two assertions:

```typescript
expect(jwtService.sign).toHaveBeenCalledWith({
  sub: 'user-1',
  email: 'user@example.com',
  roles: ['CUSTOMER'],
  authorizationVersion: 0,
});
```

(Apply this same change at both line ~491 and line ~615 — same shape, same fixture value.)

- [ ] **Step 6: Fix any other `JwtPayload`-shaped test fixtures that now fail to compile**

Run: `npm run typecheck`
Expected: lists every fixture object missing `authorizationVersion`. Known locations from the codebase search done during planning: `src/auth/guards/roles.guard.spec.ts` (`createContext({ sub: 'user-1', roles: ['ADMIN'] })`) and `src/auth/guards/ownership.guard.spec.ts` (already touched in Task 3, but re-check). Add `authorizationVersion: 0` to every such object literal until `typecheck` is clean.

- [ ] **Step 7: Run the full unit test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 8: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: PASS — login/refresh e2e specs exercise the real `JwtStrategy` against a real test DB, so this is the strongest signal that issuing and verifying the new payload field works end-to-end.

- [ ] **Step 9: Commit**

```bash
git add src/auth/strategies/jwt.strategy.ts src/auth/strategies/jwt.strategy.spec.ts src/auth/services/auth.service.ts src/auth/services/auth.service.spec.ts src/auth/guards/roles.guard.spec.ts
git commit -m "feat: verify authorizationVersion on every request, fail closed on mismatch (Mục 13)"
```

---

### Task 5: Health checks (`/health/live`, `/health/ready`) + graceful shutdown

**Files:**

- Create: `src/health/health.module.ts`
- Create: `src/health/health.controller.ts`
- Create: `src/health/prisma-health.indicator.ts`
- Create: `test/health.e2e-spec.ts`
- Modify: `src/app.module.ts` (import `HealthModule`)
- Modify: `src/main.ts` (`app.enableShutdownHooks()`)

**Interfaces:**

- Consumes: `PrismaService` (existing).
- Produces: `GET /api/v1/health/live` → `200`; `GET /api/v1/health/ready` → `200`/`503` depending on Postgres reachability. Nothing downstream depends on this yet (Phase 1 is the first consumer of Terminus in this repo).

- [ ] **Step 1: Install `@nestjs/terminus`**

Run: `npm install @nestjs/terminus`
Expected: added to `package.json` `dependencies`.

- [ ] **Step 2: Write the custom Prisma health indicator**

Create `src/health/prisma-health.indicator.ts`:

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

- [ ] **Step 3: Write the health controller**

Create `src/health/health.controller.ts`:

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

- [ ] **Step 4: Write the health module**

Create `src/health/health.module.ts`:

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

- [ ] **Step 5: Register `HealthModule` in `AppModule`**

Edit `src/app.module.ts` — add the import:

```typescript
import { HealthModule } from './health/health.module.js';
```

and add `HealthModule` to the `imports: [...]` array (alongside `PrismaModule`, `AuthModule`).

- [ ] **Step 6: Write the failing e2e test**

Create `test/health.e2e-spec.ts`:

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

- [ ] **Step 7: Run it to confirm the first two pass and see where things stand**

Run: `npm run test:e2e -- health`
Expected: if Steps 1-5 are in place, all 3 should already PASS at this point (this task isn't strict red-green since the controller was written before the test) — treat any FAIL here as a bug in Steps 2-5 to fix now, not later.

- [ ] **Step 8: Enable graceful shutdown**

Edit `src/main.ts` — add one line after `configureApp(app)`:

```typescript
configureApp(app);
app.enableShutdownHooks();
```

(This makes Nest call `PrismaService.onModuleDestroy()` — already implemented, `await this.$disconnect()` — on `SIGTERM`/`SIGINT`, so the connection pool closes cleanly instead of being killed mid-query during a rolling deploy.)

- [ ] **Step 9: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/health/ src/app.module.ts src/main.ts test/health.e2e-spec.ts package.json package-lock.json
git commit -m "feat: add /health/live and /health/ready (ADR 0008), enable graceful shutdown"
```

---

### Task 6: Baseline Prometheus metrics (`GET /metrics`)

**Files:**

- Create: `src/metrics/metrics.module.ts`
- Create: `src/metrics/metrics.controller.ts`
- Create: `src/metrics/metrics.interceptor.ts`
- Create: `test/metrics.e2e-spec.ts`
- Modify: `src/app.module.ts` (import `MetricsModule`, register interceptor as `APP_INTERCEPTOR`)

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: `GET /metrics` (note: **not** under `/api/v1` — Prometheus scrape convention is a bare `/metrics` path) returning Prometheus exposition-format text. No other task consumes this.

- [ ] **Step 1: Install `prom-client`**

Run: `npm install prom-client`

- [ ] **Step 2: Write the metrics interceptor**

Create `src/metrics/metrics.interceptor.ts`:

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

- [ ] **Step 3: Write the metrics controller**

Create `src/metrics/metrics.controller.ts`:

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

- [ ] **Step 4: Write the metrics module**

Create `src/metrics/metrics.module.ts`:

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

- [ ] **Step 5: Register `MetricsModule` in `AppModule`**

Edit `src/app.module.ts` — add the import and add `MetricsModule` to `imports: [...]`. (No provider changes needed at the `AppModule` level — `MetricsModule` registers its own `APP_INTERCEPTOR`.)

- [ ] **Step 6: Note the `/metrics` route is unversioned/unprefixed**

Because `MetricsController` uses `@Controller('metrics')` and the global prefix (`app.setGlobalPrefix('api')` from Task 1) applies to _every_ controller by default, `/metrics` would otherwise become `/api/metrics`. Prometheus scrape convention expects a bare `/metrics`. Exclude it from the global prefix — edit `src/bootstrap/configure-app.ts`:

```typescript
app.setGlobalPrefix('api', { exclude: ['metrics'] });
```

- [ ] **Step 7: Write the failing e2e test**

Create `test/metrics.e2e-spec.ts`:

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

- [ ] **Step 8: Run it**

Run: `npm run test:e2e -- metrics`
Expected: PASS (same as Task 5 Step 7 — implementation preceded the test here; treat a FAIL as a bug in Steps 2-6, fix now).

- [ ] **Step 9: Run the full e2e suite to confirm the `exclude: ['metrics']` change didn't break anything else**

Run: `npm run test:e2e`
Expected: PASS

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

- Consumes: nothing (standalone).
- Produces: a buildable image tagged locally as `nestjs-demo:local` — consumed by Task 8's `docker-compose.yml` (`build: .`) and Task 9's CI build step.

- [ ] **Step 1: Write `.dockerignore`**

Create `.dockerignore`:

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

- [ ] **Step 2: Write the multi-stage `Dockerfile`**

Create `Dockerfile`:

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

- [ ] **Step 3: Build the image**

Run: `docker build -t nestjs-demo:local .`
Expected: build succeeds, ends with `naming to docker.io/library/nestjs-demo:local`.

- [ ] **Step 4: Sanity-check the image starts (it will fail fast without env vars — that's expected and correct, per `env.validation.ts`)**

Run: `docker run --rm nestjs-demo:local`
Expected: process exits non-zero with an error mentioning missing `DATABASE_URL`/`JWT_ACCESS_SECRET`/etc — this proves the fail-fast env validation (`src/config/env.validation.ts`) runs correctly inside the container. This is the expected/correct failure mode standalone; Task 8's Compose setup supplies real env vars.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add multi-stage Dockerfile for production image"
```

---

### Task 8: `docker-compose.yml` for local development

**Files:**

- Create: `docker-compose.yml`

**Interfaces:**

- Consumes: `Dockerfile` from Task 7.
- Produces: a local 3-container stack (`api`, `postgres`, `redis`) — `redis` is unused by app code in this phase (Global Constraints), present only so future phases don't need a Compose change to start using it.

- [ ] **Step 1: Write `docker-compose.yml`**

Create `docker-compose.yml`:

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

- [ ] **Step 2: Bring the stack up**

Run: `docker compose up --build -d`
Expected: all 3 containers start; `docker compose ps` shows `postgres` as `healthy`.

- [ ] **Step 3: Apply migrations against the Compose Postgres, then verify readiness**

Run: `docker compose exec api npx prisma migrate deploy`
Expected: all migrations from Tasks 2-3 apply cleanly to the fresh Compose Postgres.

Run: `curl -i http://localhost:3000/api/v1/health/ready`
Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 4: Tear down**

Run: `docker compose down -v`
Expected: containers and volumes removed cleanly.

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

- Consumes: `Dockerfile` from Task 7 (build job), the full test suite from Tasks 1-6.
- Produces: a required status check on every PR into `master`.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/ci.yml`:

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

- [ ] **Step 2: Push the branch and open a PR to trigger the workflow**

Run: `git push -u origin HEAD`

Then open a PR (or push to an existing PR branch) so `pull_request` triggers.

- [ ] **Step 3: Watch the run**

Run: `gh run watch` (after the push triggers a run — `gh run list` first if you need the run ID)
Expected: all 5 jobs (`lint`, `typecheck`, `unit-test`, `e2e-test`, `build`) succeed.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow (lint, typecheck, unit+e2e test, build)"
```

---

## Final Verification Checklist

Run through this once all 9 tasks are committed, on a clean clone if possible:

- [ ] `npm run lint` — passes
- [ ] `npm run typecheck` — passes
- [ ] `npm run test` — all unit tests pass
- [ ] `npm run test:e2e` — all e2e tests pass, including `versioning`, `health`, `metrics`
- [ ] `curl http://localhost:3000/auth/login` (unversioned, app running locally) → `404`
- [ ] `curl http://localhost:3000/api/v1/health/live` → `200 {"status":"ok"}`
- [ ] `curl http://localhost:3000/api/v1/health/ready` → `200` (Postgres up), `503` when Postgres is stopped
- [ ] `curl http://localhost:3000/metrics` → Prometheus exposition text containing `http_requests_total`
- [ ] `curl http://localhost:3000/docs` → Swagger UI loads
- [ ] `docker compose up --build` → all 3 services start, `api` reaches `ready`
- [ ] GitHub Actions CI is green on the PR
- [ ] `SELECT name FROM roles` → `CUSTOMER`, `ORDER_STAFF`, `STORE_MANAGER`, `MASTER_ADMIN` (no `ADMIN`)
- [ ] A user's login → role change (manually via `psql`, bump `authorization_version`) → old access token now gets `401` on any protected route
- [ ] No new folder exists under `src/` for any business module (`products/`, `users/`, `cart/`, etc.) — only `src/health/` and `src/metrics/` were added
