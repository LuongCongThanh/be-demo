---
paths:
  - 'prisma/**/*.prisma'
  - 'prisma/seed.ts'
  - 'src/**/*.service.ts'
---

# Prisma schema & client — agent-condensed (đầy đủ 31-bước walkthrough: docs/convention/ecommerce-prisma-schema-guide.md)

Bản rút gọn cho agent viết/sửa schema + Prisma Client call — không lặp lại code mẫu 15-bảng, chỉ liệt kê quy tắc áp dụng cho mọi model mới.

## Schema conventions

- Multi-file schema (`prisma/schema/*.prisma`) — Prisma tự merge mọi file trong thư mục, không cần import. Enum khai ở `prisma/schema/enums.prisma`.
- Naming: model `PascalCase` số ít, bảng thật `snake_case` số nhiều qua `@@map("...")`. Field code `camelCase`, cột DB `snake_case` qua `@map("...")`.
- **`Decimal` cho tiền tệ, không bao giờ `Float`** (sai số nhị phân khi cộng trừ).
- Timestamp dùng `@db.Timestamptz(6)` (có timezone). PK dùng `id String @id @default(uuid()) @db.Uuid` trừ khi resource khác đã chọn `Int @default(autoincrement())` — quyết định này ảnh hưởng `ParseUUIDPipe` vs `ParseIntPipe` ở controller.
- FK luôn khai theo cặp: cột FK thật (`xId String @map("x_id") @db.Uuid`) + field quan hệ (`x X @relation(fields: [xId], references: [id])`).
- `onDelete`: **luôn khai rõ tay**, không phụ thuộc mặc định. `Cascade` cho quan hệ con phụ thuộc hoàn toàn vào cha (ảnh sản phẩm, giỏ hàng...). `Restrict` cho record là hồ sơ tài chính/lịch sử không được mất khi xoá cha (Order, OrderItem).
- Composite PK (bảng nối M:N thuần) dùng `@@id([a, b])` ở cuối model, không cần cột `id` riêng.
- `@@index([...])` cho query lọc/sort thường xuyên — thứ tự field trong index phải khớp thứ tự dùng trong `where`/`orderBy` để Postgres dùng Index Scan thay vì Seq Scan (kiểm bằng `EXPLAIN ANALYZE`).
- **Partial unique index (`UNIQUE ... WHERE ...`) không viết được trong Prisma DSL** — phải: `prisma migrate dev --create-only` → sửa tay SQL migration thêm `CREATE UNIQUE INDEX ... WHERE ...` → mới `prisma migrate dev` áp dụng thật.
- Mọi lệnh `prisma` cần `--config prisma7.config.ts` (project không dùng tên mặc định `prisma.config.ts`). Prisma v7: `migrate dev` **không** tự chạy `generate`/seed — gọi riêng khi cần.

## Prisma Client trong NestJS

- 1 domain = 1 module, tất cả inject chung `PrismaService` global — không tạo `PrismaService` riêng/không cần Repository layer cho quy mô hiện tại.
- Business operation cần atomic (checkout: tạo Order + trừ inventory + đổi cart status) → `prisma.$transaction(async (tx) => {...})` interactive; mọi câu lệnh dùng `tx.` không phải `this.prisma.`. Lỗi bên trong tự rollback toàn bộ.
- Update số lượng dùng atomic operator (`{ decrement: n }`) thay vì đọc-rồi-ghi tay để tránh race condition.
- Tránh N+1: dùng `include`/`select` để JOIN trong 1 query thay vì loop gọi lại DB. Bật `log: ['query']` tạm thời để soi N+1 khi nghi ngờ.
- Pagination: offset (`skip`/`take`) cho dashboard admin ít dữ liệu; cursor (`cursor: { id }` + `skip: 1`) cho listing public nhiều dữ liệu, khớp với `@@index` đã khai.
- Rủi ro oversell/race condition thật (checkout, giữ chỗ) → cân nhắc `{ isolationLevel: 'Serializable' }` kèm retry logic khi gặp lỗi `P2034`, không áp dụng tràn lan (chậm hơn mặc định `Read Committed`).
- Sửa schema khi đã có data thật: thêm cột bắt buộc phải kèm `@default(...)` hoặc để nullable trước; đổi tên field cần `@map` giữ cột cũ hoặc chấp nhận sửa tay SQL rename; luôn `migrate dev --create-only` để soi SQL trước khi apply cho thay đổi có rủi ro mất data.
- `migrate dev` chỉ dùng máy dev; `migrate deploy` dùng production/CI (không tự sinh migration mới). Không có rollback tự động — revert bằng migration mới làm ngược lại.
