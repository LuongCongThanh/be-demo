# be-demo — Ecommerce backend (NestJS + Prisma)

Backend cho cửa hàng thời trang bán online tại Việt Nam: Danh mục & Sản phẩm, Giỏ hàng, Đặt hàng, Thanh toán (VNPay, MoMo, COD), Vận chuyển (GHN), Đổi trả & Hoàn tiền, back-office cho Staff/Admin.

**Stack:** Node 24 · NestJS · Prisma 7 · PostgreSQL 17 · Redis · Vitest · oxlint · Docker · GitHub Actions

## Bắt đầu nhanh

```bash
nvm use                      # Node theo .nvmrc
npm install                  # cài dependency + git hooks (husky)
cp .env.example .env         # điền giá trị (xem bảng bên dưới)
docker compose up -d postgres redis
npm run prisma:generate
npx prisma migrate dev --config prisma7.config.ts
npm run db:seed
npm run start:dev
```

- API: <http://localhost:3000/api>
- Swagger: <http://localhost:3000/docs>
- Metrics: <http://localhost:3000/metrics>

Chạy toàn bộ bằng Docker: `docker compose up --build`.

### Biến môi trường

| Biến                                                                       | Bắt buộc | Ghi chú                           |
| -------------------------------------------------------------------------- | -------- | --------------------------------- |
| `DATABASE_URL`                                                             | ✓        | PostgreSQL connection string      |
| `JWT_ACCESS_SECRET`                                                        | ✓        | ≥ 32 ký tự                        |
| `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`                        | ✓        | Tài khoản admin đầu tiên khi seed |
| `PORT`, `JWT_ACCESS_TTL`, `REFRESH_TOKEN_TTL`, `REFRESH_TOKEN_COOKIE_NAME` |          | Có giá trị mặc định               |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`            |          | Gửi email                         |
| `FRONTEND_URL`                                                             |          | Link trong email                  |
| `POSTMAN_API_KEY`, `POSTMAN_COLLECTION_ID`                                 |          | Chỉ cho `npm run postman:sync`    |

Ứng dụng validate env lúc khởi động và dừng ngay nếu thiếu biến bắt buộc (`src/config/env.validation.ts`).

## Lệnh thường dùng

| Lệnh                                   | Việc                                    |
| -------------------------------------- | --------------------------------------- |
| `npm run start:dev`                    | Chạy dev, tự reload                     |
| `npm run build` / `npm run start:prod` | Build và chạy bản production            |
| `npm run lint`                         | oxlint                                  |
| `npm run typecheck`                    | `tsc --noEmit`                          |
| `npm run test` / `npm run test:cov`    | Unit test / kèm coverage (ngưỡng 50%)   |
| `npm run test:e2e`                     | E2E, cần Postgres đang chạy và đã seed  |
| `npm run prisma:generate`              | Sinh Prisma Client vào `src/generated/` |
| `npm run db:seed`                      | Seed dữ liệu                            |
| `npm run postman:sync`                 | Đồng bộ Swagger sang Postman            |

## Cấu trúc thư mục

```text
be-demo/
├── .claude/               # cấu hình Claude Code: rules, hooks, commands, skills
├── .github/
│   ├── workflows/         # ci.yml (lint, typecheck, test, e2e, docs-links, build), pr-title.yml
│   ├── pull_request_template.md
│   └── CODEOWNERS
├── .husky/                # pre-commit, commit-msg, pre-push
├── docs/                  # tài liệu dự án — bắt đầu từ docs/README.md
├── prisma/
│   ├── schema/            # schema Prisma tách nhiều file
│   ├── migrations/
│   └── seed.ts
├── scripts/               # script phụ trợ (đồng bộ Postman, …)
├── src/                   # mã nguồn — chi tiết: docs/architecture/02-modules.md §4
├── test/                  # e2e (*.e2e-spec.ts) và test/support
├── GLOSSARY.md            # thuật ngữ domain chuẩn
├── commitlint.config.mjs
├── docker-compose.yml
├── Dockerfile
└── prisma7.config.ts
```

Cấu trúc bên trong `src/` (hiện tại và mục tiêu): [`docs/architecture/02-modules.md` §4](docs/architecture/02-modules.md#4-cấu-trúc-thư-mục).

## Tài liệu

Mục lục ở [`docs/README.md`](docs/README.md). Thứ tự đọc: [`docs/business/`](docs/business/) (nghiệp vụ, nguồn ưu tiên) → [`GLOSSARY.md`](GLOSSARY.md) → [`docs/architecture/`](docs/architecture/) → [`docs/adr/`](docs/adr/) → [`docs/convention/`](docs/convention/).

## Quy trình đóng góp

- Branch tách từ `dev`: `feature/*`, `fix/*`, `chore/*`, `docs/*` (kebab-case). Không push thẳng lên `main`/`dev`.
- Commit và tiêu đề PR theo Conventional Commits, không có AI attribution.
- Hook local: `pre-commit` (lint-staged) → `commit-msg` (commitlint) → `pre-push` (kiểm tra branch, typecheck, test).
- PR vào `dev` dùng Squash and Merge; `dev` → `main` dùng Merge Commit.

Chi tiết: [`docs/convention/git-workflow.md`](docs/convention/git-workflow.md).
