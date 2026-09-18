# Phase 1 — Nền tảng hạ tầng: Design Spec

> Phase 1 trong `doc/ecommerce-backend-architecture-system-design-2.md` Mục 22. Đây là prerequisite bắt buộc trước khi bất kỳ module nghiệp vụ mới nào (Phase 2+: Categories, Products, ...) được build.

## 1. Bối cảnh & vấn đề

Auth đã xong (🟢), nhưng runtime hiện tại chưa đáp ứng các nền tảng mà mọi phase sau phụ thuộc vào:

- Route vẫn ở `/auth/*` (chưa versioned) — ADR 0002 đã chốt `/api/v1/*` nhưng chưa implement.
- Role trong DB vẫn là `ADMIN` (nhãn cũ) — ADR 0005 đã chốt 4 role chuẩn (`CUSTOMER`, `ORDER_STAFF`, `STORE_MANAGER`, `MASTER_ADMIN`) nhưng chưa migrate.
- Không có `authorization_version` trên `users` — cần cho việc thu hồi quyền tức thời khi role/status đổi (Mục 13).
- Không có `Dockerfile`, `docker-compose.yml`, `.github/workflows` — xác nhận tại Mục 0 của tài liệu kiến trúc.
- Không có health check phân biệt theo dependency — ADR 0008 đã chốt readiness chỉ phụ thuộc Postgres, không phụ thuộc Redis, nhưng chưa có endpoint nào tồn tại.
- Không có metrics — chỉ có structured log (đã xong qua `AppLogger`/`RequestIdMiddleware`).

## 2. Phạm vi (Scope)

Đúng 6 việc theo Mục 22 Phase 1, đã chốt cách làm qua brainstorming:

1. **API versioning** — global prefix `api`, Nest URI versioning `1` → `/api/v1/*`; Swagger chuyển sang `/docs`.
2. **Role migration** — rename `ADMIN` → `MASTER_ADMIN`, seed 3 role còn lại; thêm `users.authorization_version`.
3. **Health check** — `@nestjs/terminus`, `GET /health/live` + `GET /health/ready` (chỉ phụ thuộc Postgres, theo ADR 0008).
4. **Metrics cơ bản** — `GET /metrics` qua `prom-client` (request count + latency histogram).
5. **Docker + Compose local** — `Dockerfile` multi-stage, `docker-compose.yml` (services: `api`, `postgres`, `redis` — Redis chỉ để sẵn container, chưa wire vào app).
6. **CI (GitHub Actions)** — lint → typecheck → unit test → e2e test → build, chạy trên PR + push `master`.

Cộng: **graceful shutdown** (`app.enableShutdownHooks()`) — gộp vào việc #3 vì cùng chỗ sửa (`main.ts`) và cùng lý do tồn tại (health/readiness chỉ có ý nghĩa nếu shutdown sạch).

## 3. Non-goals

- Grafana/Loki/Prometheus server thật, dashboard — đó là Mục 15 / Phase 9, khi có nhu cầu quan sát thật.
- Production deployment topology (load balancer, managed Postgres/Redis) — Mục 16, chỉ áp dụng khi deploy thật.
- Wiring Redis vào bất kỳ feature nào (cache, rate limit, BullMQ) — Redis trong Phase 1 chỉ là container có sẵn trong compose, chưa được app dùng.
- **Tạo trước folder cho bất kỳ module nghiệp vụ nào** (`products/`, `users/`, `cart/`, `orders/`, `inventory/`, `payments/`, `promotions/`) — cây thư mục ở Mục 3 của tài liệu kiến trúc là đích cuối sau cả 9 phase, không phải checklist của Phase 1. Module nào tới phase của nó (Mục 22) mới được tạo, cùng lúc với code/test/DTO thật — không tạo skeleton rỗng trước.

## 4. Kiến trúc & thay đổi theo từng việc

### 4.1 API versioning (ADR 0002)

- `main.ts`: `app.setGlobalPrefix('api')` + `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`.
- Route hiện tại `@Controller('auth')` không cần sửa (path tương đối) — Nest tự ghép thành `/api/v1/auth/*`.
- Swagger: `SwaggerModule.setup('docs', app, document)` (đổi từ `'api'` — tránh trùng global prefix mới).
- **Không giữ alias không-version vĩnh viễn** (đã chốt ở Mục 8) — `/auth/*` cũ trả 404 sau migrate, không redirect.
- Cookie path cho refresh token (nếu có set `path` tường minh) cần khớp `/api/v1/auth` — kiểm tra `token.service.ts`/cookie options.

### 4.2 Role migration + `authorization_version` (ADR 0005, Mục 13)

- Migration SQL: `UPDATE roles SET name = 'MASTER_ADMIN' WHERE name = 'ADMIN'` + insert 3 role mới (`CUSTOMER`, `ORDER_STAFF`, `STORE_MANAGER`) nếu chưa tồn tại — viết tay trong file migration (không qua `prisma migrate dev` tự sinh diff, vì đây là data migration, không phải schema diff).
- Schema change đi kèm: thêm cột `users.authorization_version INT NOT NULL DEFAULT 0` — đây **là** schema diff, đi qua `prisma migrate dev` bình thường (thêm field vào `schema.prisma` trước).
- `prisma/seed.ts`: đổi `where/create: { name: 'ADMIN' }` → `{ name: 'MASTER_ADMIN' }`.
- `auth/strategies/jwt.strategy.ts`: JWT payload cần mang `authorizationVersion` lúc issue token; `validate()` so sánh với giá trị hiện tại trong DB — lệch thì reject (401), theo đúng "fail closed" ở Mục 13.
- `auth/services/token.service.ts`: khi issue access token, đọc `authorizationVersion` hiện tại của user, nhúng vào payload.
- Bất cứ nơi nào tăng version (đổi role/status User) **chưa tồn tại trong Phase 1** — đó là API của module Users (Phase 3). Phase 1 chỉ tạo cột + cơ chế đọc/so sánh trong JWT strategy, không tạo endpoint đổi role.

### 4.3 Health check (ADR 0008)

- Thêm dependency `@nestjs/terminus`.
- Module mới `src/health/` (flat — 1 controller, 1 module, giống pattern `mail/`):
  - `GET /health/live` — luôn `200 { status: 'ok' }` nếu process nhận được request (không check gì).
  - `GET /health/ready` — `TerminusModule` + `PrismaHealthIndicator` (custom, query `SELECT 1` qua `PrismaService`) — `200` nếu Postgres reachable, `503` nếu không. **Không** check Redis (chưa tồn tại trong app, và ADR 0008 cấm gắn readiness vào Redis dù có tồn tại).
- `main.ts`: `app.enableShutdownHooks()` — cho Nest gọi `onModuleDestroy`/đóng Prisma pool khi nhận `SIGTERM`.

### 4.4 Metrics cơ bản

- Thêm dependency `prom-client`.
- Module mới `src/metrics/` (flat) hoặc gộp vào `src/health/` nếu chỉ 1-2 file — quyết định lúc code theo đúng quy tắc "flat nếu ít file" (coding-style-conventions §2); đề xuất tách riêng vì mục đích khác nhau (health = liveness/readiness, metrics = observability).
- Interceptor global (`APP_INTERCEPTOR`) đo latency mỗi request, ghi vào 1 Histogram (`http_request_duration_seconds`, label `method`, `route`, `status_code`) + 1 Counter (`http_requests_total`).
- `GET /metrics` — trả plaintext Prometheus exposition format (`prom-client`'s `register.metrics()`). Endpoint này **không** qua `ValidationPipe`/versioning — nằm ngoài `/api/v1` (scrape convention chuẩn là `/metrics` ở root).

### 4.5 Docker + Compose local (Mục 17)

- `Dockerfile` multi-stage: stage `build` (`node:22-alpine`, `npm ci`, `npm run build`, `npx prisma generate`), stage `runtime` (copy `dist/` + `node_modules` production + `generated/prisma`, `CMD ["node", "dist/main"]`).
- `docker-compose.yml`: service `postgres` (image `postgres:17-alpine`, volume, healthcheck `pg_isready`), service `redis` (image `redis:8-alpine`, **chỉ để sẵn**, không app nào connect), service `api` (build từ Dockerfile, `depends_on: postgres` với `condition: service_healthy`, đọc `.env`).
- `.dockerignore` — loại `node_modules`, `dist`, `.git`, `generated/` khỏi build context (generated được tạo lại trong stage build).

### 4.6 CI — GitHub Actions

- `.github/workflows/ci.yml`, trigger `pull_request` + `push` vào `master`.
- Jobs tuần tự (hoặc parallel với `needs`): `lint` (`npm run lint`) → `typecheck` (`npm run typecheck`) → `test` (`npm run test`) → `test:e2e` (cần service container `postgres:17-alpine`, set `DATABASE_URL` + secrets khác qua GitHub Actions secrets/env, `npx prisma migrate deploy` trước khi test) → `build` (`npm run build` + build Docker image, không push).

## 5. Thứ tự thực hiện

Mỗi bước tự verify được trước khi sang bước sau — không có bước nào block bước sau về mặt kỹ thuật (đều độc lập), nhưng thứ tự này giảm rework:

```
1. API versioning       (rủi ro thấp, review nhanh)
2. Role migration + authorization_version
3. Health check + graceful shutdown
4. Metrics cơ bản
5. Docker + Compose local  (cần main.ts đã ổn định từ 1-4)
6. CI                     (cần Dockerfile từ #5 để build-test thật)
```

## 6. Testing

- **#1**: e2e — request tới `/auth/register` (path cũ) trả `404`; `/api/v1/auth/register` hoạt động; `GET /docs` trả Swagger UI.
- **#2**: unit test cho `jwt.strategy.ts` (token với version cũ bị reject); seed re-run idempotent (không lỗi khi role đã tồn tại); migration test — chạy migration trên DB có sẵn `ADMIN` role + user liên kết, xác nhận `UserRole` FK không vỡ.
- **#3**: e2e — `/health/live` luôn 200; `/health/ready` trả 503 khi override `PrismaService` để throw (dùng pattern override có sẵn ở `test/support/create-test-app.ts`), 200 khi bình thường.
- **#4**: unit/e2e — gọi vài request rồi `GET /metrics`, assert response chứa `http_requests_total`.
- **#5**: manual — `docker compose up`, `curl localhost:3000/health/ready` trả 200.
- **#6**: CI tự verify bằng cách chạy trên PR chứa các thay đổi trên — pass nghĩa là đạt.

## 7. Error handling

Không có case mới cần `AllExceptionsFilter` xử lý riêng — health/metrics endpoints không throw business exception, chỉ trả status code trực tiếp qua Terminus/prom-client convention chuẩn.

## 8. Cấu trúc thư mục — chỉ thêm, không refactor

Không di chuyển/đổi tên file hiện có (trừ giá trị seed). Chỉ thêm:

```
Dockerfile
docker-compose.yml
.dockerignore
.github/workflows/ci.yml
src/health/health.module.ts
src/health/health.controller.ts
src/health/prisma-health.indicator.ts
src/metrics/metrics.module.ts
src/metrics/metrics.controller.ts
src/metrics/metrics.interceptor.ts
prisma/migrations/<ts>_add-authorization-version/
prisma/migrations/<ts>_rename-admin-to-master-admin/
```

Không tạo `products/`, `users/`, `cart/`, `orders/`, `inventory/`, `payments/`, `promotions/` — các module đó được tạo ở phase riêng của chúng (Mục 22), cùng lúc với code/test thật.
