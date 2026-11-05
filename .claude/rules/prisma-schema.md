---
paths:
  - 'prisma/**/*.prisma'
  - 'prisma/seed.ts'
  - 'src/**/*.service.ts'
---

# Prisma schema & client — agent-condensed (đầy đủ: docs/convention/prisma-conventions.md; schema đích: docs/architecture/11-database.md)

Bản rút gọn cho agent viết/sửa schema + Prisma Client call — chỉ liệt kê quy tắc áp dụng cho mọi model mới; bảng/cột/index cụ thể tra ở `11-database.md`.

## Schema conventions

- Multi-file schema (`prisma/schema/*.prisma`) — Prisma tự merge mọi file trong thư mục, không cần import. Enum khai ở `prisma/schema/enums.prisma`.
- Naming: model `PascalCase` số ít, bảng thật `snake_case` số nhiều qua `@@map("...")`. Field code `camelCase`, cột DB `snake_case` qua `@map("...")`.
- **Tiền là `BigInt` (VND số nguyên)** — không `Float`, không `Decimal`; CHECK `>= 0` viết trong SQL migration.
- Timestamp dùng `@db.Timestamptz(6)` (có timezone). PK dùng `id String @id @db.Uuid` (UUID v7 sinh ở app); ngoại lệ: bảng tra cứu có mã tự nhiên và bảng nối.
- FK luôn khai theo cặp: cột FK thật (`xId String @map("x_id") @db.Uuid`) + field quan hệ (`x X @relation(fields: [xId], references: [id])`).
- `onDelete`: **luôn khai rõ tay**, không phụ thuộc mặc định. Chọn theo `11-database.md` §3.3: `Cascade` cho con thuần tuý (`cart_items`, `refresh_tokens`); `Restrict` cho tài chính/lịch sử và cây danh mục. Mọi FK phải có index.
- Composite PK (bảng nối M:N thuần) dùng `@@id([a, b])` ở cuối model, không cần cột `id` riêng.
- `@@index([...])` cho query lọc/sort thường xuyên — thứ tự field trong index phải khớp thứ tự dùng trong `where`/`orderBy` để Postgres dùng Index Scan thay vì Seq Scan (kiểm bằng `EXPLAIN ANALYZE`).
- **Partial unique index (`UNIQUE ... WHERE ...`) không viết được trong Prisma DSL** — phải: `prisma migrate dev --create-only` → sửa tay SQL migration thêm `CREATE UNIQUE INDEX ... WHERE ...` → mới `prisma migrate dev` áp dụng thật.
- Mọi lệnh `prisma` cần `--config prisma7.config.ts` (project không dùng tên mặc định `prisma.config.ts`). Prisma v7: `migrate dev` **không** tự chạy `generate`/seed — gọi riêng khi cần.

## Prisma Client trong NestJS

- 1 domain = 1 module, tất cả inject chung `PrismaService` global — không tạo `PrismaService` riêng/không cần Repository layer cho quy mô hiện tại.
- Business operation cần atomic (vd. checkout) → `prisma.$transaction(async (tx) => {...})` interactive; mọi câu lệnh dùng `tx.` không phải `this.prisma.`. Lỗi bên trong tự rollback toàn bộ.
- Update số lượng dùng atomic operator (`{ decrement: n }`) thay vì đọc-rồi-ghi tay để tránh race condition.
- Tránh N+1: dùng `include`/`select` để JOIN trong 1 query thay vì loop gọi lại DB. Bật `log: ['query']` tạm thời để soi N+1 khi nghi ngờ.
- Pagination: offset (`skip`/`take`) cho dashboard admin ít dữ liệu; cursor (`cursor: { id }` + `skip: 1`) cho listing public nhiều dữ liệu, khớp với `@@index` đã khai.
- Race condition → ưu tiên row lock `SELECT ... FOR UPDATE` (`$queryRaw` trong `tx`) hoặc update có điều kiện, theo `docs/architecture/04-data-consistency.md`; chỉ cân nhắc `{ isolationLevel: 'Serializable' }` kèm retry logic khi gặp lỗi `P2034`, không áp dụng tràn lan (chậm hơn mặc định `Read Committed`).
- Sửa schema khi đã có data thật: thêm cột bắt buộc phải kèm `@default(...)` hoặc để nullable trước; đổi tên field cần `@map` giữ cột cũ hoặc chấp nhận sửa tay SQL rename; luôn `migrate dev --create-only` để soi SQL trước khi apply cho thay đổi có rủi ro mất data.
- `migrate dev` chỉ dùng máy dev; `migrate deploy` dùng production/CI (không tự sinh migration mới). Không có rollback tự động — revert bằng migration mới làm ngược lại.
