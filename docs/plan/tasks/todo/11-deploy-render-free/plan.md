# Plan: deploy backend miễn phí (Render + Neon)

> Trạng thái: **nháp, chờ duyệt**. Chưa sửa code nào. Duyệt xong mới tạo `spec.md` và thêm dòng vào `docs/plan/README.md`.

## Mục tiêu

Đưa API lên một URL HTTPS công khai, chi phí 0đ, để FE (deploy riêng) gọi được. Phạm vi là demo/portfolio, không phải production thật.

## Kiến trúc

```text
FE (Cloudflare Pages / Vercel)
   │  HTTPS, CORS + cookie
   ▼
Render Web Service (free) ── Docker từ Dockerfile sẵn có
   │
   ├── Neon Postgres (free)       DATABASE_URL
   └── Brevo SMTP (free)          SMTP_*   (tuỳ chọn)
```

**Không cần Redis/Upstash**: `REDIS_URL` trong `.env.example` đang đánh dấu `[PLANNED]`, code hiện chưa dùng. Khi nào làm queue/rate limit mới thêm Upstash.

## Giới hạn gói free cần chấp nhận

> Theo hiểu biết hiện tại, các nhà cung cấp hay đổi — kiểm tra lại trang pricing trước khi đăng ký.

| Dịch vụ     | Giới hạn                                                                             | Ảnh hưởng                                 |
| ----------- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| Render free | Ngủ sau ~15 phút không có request, khởi động lại ~30–60s; RAM 512 MB; ~750 giờ/tháng | Request đầu tiên sau lúc rảnh sẽ chậm     |
| Neon free   | ~0.5 GB, compute tự tạm dừng khi rảnh                                                | Query đầu tiên sau lúc rảnh chậm thêm ~1s |
| Brevo free  | ~300 email/ngày                                                                      | Đủ cho demo                               |

## Các vấn đề phải sửa trong code (phát hiện khi đọc repo)

### 1. Container không chạy được `prisma migrate deploy` (bắt buộc)

`Dockerfile` stage runtime chạy `npm ci --omit=dev`, mà `prisma` (CLI) nằm ở `devDependencies` → image không có lệnh migrate. Render free **không có** Pre-Deploy Command.

Chọn 1 trong 2:

- **(A) Khuyên dùng — migrate lúc container khởi động:** chuyển `prisma` sang `dependencies`, đổi `CMD` thành `npx prisma migrate deploy --config prisma7.config.ts && node dist/main.js`, và copy `prisma7.config.ts` vào image. Ưu: tự động mỗi lần deploy. Nhược: image to hơn một chút; nếu migrate lỗi thì app không lên (đây cũng là điều mong muốn).
- **(B) Migrate từ máy local / GitHub Action** trỏ vào Neon trước mỗi lần deploy. Ưu: image giữ nguyên. Nhược: dễ quên, phải làm tay.

Lưu ý thêm: `prisma7.config.ts` có `import 'dotenv/config'` — `dotenv` phải có trong runtime (kiểm tra lại khi làm) hoặc đổi config để không bắt buộc file `.env`.

### 2. Cookie refresh token bị chặn khi FE và BE khác domain (bắt buộc nếu FE gọi refresh)

`auth.controller.ts` set cookie `sameSite: 'strict'`. FE ở `*.pages.dev` và BE ở `*.onrender.com` là **khác site** → trình duyệt không gửi cookie → `/auth/refresh`, `/auth/logout` hỏng.

Chọn 1 trong 3:

- **(A) Cấu hình qua env:** thêm `REFRESH_TOKEN_COOKIE_SAMESITE` (`strict` | `lax` | `none`, mặc định `strict`), đặt `none` trên Render. `secure: true` đã có sẵn nên `none` hợp lệ. Cần khai vào `env.validation.ts` + `.env.example`.
- **(B) Proxy ở FE:** FE rewrite `/api/*` sang Render → trình duyệt thấy cùng origin, giữ `strict`. Không sửa BE, nhưng phụ thuộc nền tảng FE.
- **(C) Custom domain chung** (`app.example.com` + `api.example.com`): cùng site, giữ `strict`. Cần mua domain → không còn 0đ.

Khuyên: **(A)** — ít phụ thuộc, đổi lại được bằng env.

### 3. Seed chạy bằng `tsx` (devDependency)

Không chạy seed trong container. Chạy **một lần từ máy local** với `DATABASE_URL` trỏ vào Neon: `DATABASE_URL=<neon-direct-url> npm run db:seed`.

### 4. Swagger mặc định tắt khi `NODE_ENV=production`

Dockerfile đặt `NODE_ENV=production` → `/docs` tắt. Muốn mở cho demo thì đặt `SWAGGER_ENABLED=true` trên Render. Không cần sửa code.

## Các bước thực hiện

### Bước 0 — Sửa code (1 PR vào `dev`, branch `chore/deploy-render`)

1. Sửa Dockerfile + `package.json` theo vấn đề 1 (A).
2. Thêm cấu hình SameSite theo vấn đề 2 (A), kèm unit test cho giá trị env.
3. Build và chạy thử image ở local: `docker build -t be-demo . && docker run --env-file .env -p 8080:3000 be-demo` (DB local) — xác nhận migrate chạy và app lên.
4. Lint, typecheck, test, e2e; `/code-review`; mở PR.

### Bước 1 — Neon

1. Tạo project, region gần nhất (Singapore).
2. Lấy 2 connection string: **pooled** (cho app) và **direct** (cho migrate/seed). Cả hai có `?sslmode=require`.
3. Từ local: `DATABASE_URL=<direct> npx prisma migrate deploy --config prisma7.config.ts` rồi `DATABASE_URL=<direct> npm run db:seed`.

> Nếu chọn migrate lúc khởi động (1A), app sẽ chạy migrate bằng `DATABASE_URL` → dùng **direct URL** cho Render để tránh lỗi migrate qua pooler. Free tier ít kết nối nên không cần pooler.

### Bước 2 — Brevo (tuỳ chọn, bỏ qua nếu chưa cần email)

Tạo tài khoản, xác minh email người gửi, lấy SMTP login/key. Bỏ trống `SMTP_*` thì app chỉ log email, vẫn chạy.

### Bước 3 — Render

1. New → Web Service → kết nối repo GitHub, branch deploy (`dev` hoặc `master` — xem Câu hỏi mở).
2. Runtime: **Docker**, plan **Free**, region Singapore.
3. Health check path: `/api/v1/health/ready` (kiểm tra lại path thật sau khi deploy).
4. Khai biến môi trường (mục dưới).
5. Bật Auto-Deploy khi push.

### Bước 4 — Kiểm tra

- `GET https://<app>.onrender.com/api/v1/health/ready` → 200.
- Đăng nhập admin qua Swagger, gọi API catalog thấy 10 sản phẩm seed.
- Từ FE thật: login → refresh → logout chạy được (kiểm tra cookie SameSite).
- Đợi >15 phút, gọi lại → xác nhận app tự thức dậy.

## Biến môi trường trên Render

| Biến                                                            | Giá trị                                       | Ghi chú                                           |
| --------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| `DATABASE_URL`                                                  | Neon direct URL                               | Secret                                            |
| `JWT_ACCESS_SECRET`                                             | random ≥ 32 ký tự (`openssl rand -base64 48`) | Secret, **không** dùng lại giá trị local          |
| `ADMIN_BOOTSTRAP_EMAIL`                                         | email admin                                   | Bắt buộc theo `env.validation.ts`                 |
| `ADMIN_BOOTSTRAP_PASSWORD`                                      | mật khẩu mạnh mới                             | Secret                                            |
| `FRONTEND_URL`                                                  | URL FE, vd `https://<fe>.pages.dev`           | Dùng cho CORS + link email; **không** có `/` cuối |
| `REFRESH_TOKEN_COOKIE_SAMESITE`                                 | `none`                                        | Biến mới từ vấn đề 2 (A)                          |
| `SWAGGER_ENABLED`                                               | `true`                                        | Tuỳ chọn, cho demo                                |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Brevo: `smtp-relay.brevo.com`, `587`, ...     | Tuỳ chọn                                          |

Không đặt `PORT` — Render tự cấp và app đã đọc `PORT` qua `ConfigService`.

## Rủi ro

- **Cold start** làm FE trông như bị treo ~1 phút lần đầu → FE nên hiện loading/thông báo.
- **512 MB RAM**: NestJS + Prisma thường đủ; theo dõi log Render nếu bị OOM restart.
- **Secret**: chỉ khai trên dashboard Render/Neon, không commit, không để trong PR.
- **Migrate lúc khởi động**: migration lỗi → deploy fail, bản cũ vẫn chạy (Render giữ bản cũ khi health check fail).

## Câu hỏi mở (cần bạn quyết)

1. Render deploy từ branch nào: `dev` (mỗi PR merge là lên) hay `master` (chỉ khi release)?
2. Đồng ý chọn **1A** (migrate lúc khởi động) và **2A** (SameSite qua env) chứ?
3. FE deploy ở đâu (Cloudflare Pages / Vercel)? — cần để điền `FRONTEND_URL`.
4. Có cần gửi email thật (Brevo) ở bước này không?
