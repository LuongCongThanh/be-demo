# Prisma conventions — schema, migration & Prisma Client

Quy tắc chung khi viết `schema.prisma`, tạo migration và gọi Prisma Client trong NestJS. Tài liệu này **không** mô tả schema — nguồn sự thật về bảng, cột, quan hệ, index, CHECK là [`../architecture/11-database.md`](../architecture/11-database.md). Khi hai tài liệu mâu thuẫn, `11-database.md` thắng.

## 1. Vị trí file

```
prisma/
  schema/
    schema.prisma   — generator, datasource, toàn bộ model
    enums.prisma    — toàn bộ enum
  migrations/       — SQL migration (commit vào git, không sửa migration đã merge)
  seed.ts           — dữ liệu khởi tạo
prisma7.config.ts   — config CLI, trỏ schema: "prisma/schema"
src/generated/prisma — Prisma Client sinh ra (không sửa tay)
src/infrastructure/database/         — PrismaService + PrismaModule (@Global)
```

- Multi-file schema: Prisma tự merge mọi `.prisma` trong `prisma/schema/`, không cần import giữa các file.
- **Mọi lệnh `prisma` cần `--config prisma7.config.ts`** (project không dùng tên mặc định `prisma.config.ts`).

## 2. Naming & mapping

| Thành phần | Trong code Prisma                     | Trong DB (qua `@map`/`@@map`)                   |
| ---------- | ------------------------------------- | ----------------------------------------------- |
| Model      | `PascalCase` số ít (`ProductVariant`) | bảng `snake_case` số nhiều (`product_variants`) |
| Field      | `camelCase` (`variantId`)             | cột `snake_case` (`variant_id`)                 |
| Enum       | `PascalCase` (`OrderStatus`)          | giá trị theo `11-database.md`                   |

Kiểu dữ liệu (theo `11-database.md` §3.1):

- PK: `id String @id @db.Uuid` — UUID v7 sinh ở app. Bảng tra cứu có mã tự nhiên (`provinces.code`, `settings.key`) và bảng nối (`@@id([a, b])`) là ngoại lệ.
- **Tiền: `BigInt` (VND, số nguyên)** — không `Float`, không `Decimal`. Ràng buộc `>= 0` bằng CHECK trong SQL migration.
- Thời gian: `DateTime @db.Timestamptz(6)`, lưu UTC. Mọi bảng có `createdAt`/`updatedAt` (`@updatedAt`).
- Enum Prisma cho tập giá trị đóng do code quyết định; danh sách Admin quản lý (size, màu) là **bảng**.
- `Json` (`jsonb`) chỉ cho payload thô bên ngoài, snapshot, cấu hình.

```prisma
model CartItem {
  id        String   @id @db.Uuid
  cartId    String   @map("cart_id") @db.Uuid
  variantId String   @map("variant_id") @db.Uuid
  quantity  Int
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  cart    Cart           @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variant ProductVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)

  @@unique([cartId, variantId])
  @@index([variantId])
  @@map("cart_items")
}
```

- FK luôn khai theo cặp: cột FK + field quan hệ. **`onDelete` luôn khai rõ** — chọn theo bảng §3.3 của `11-database.md` (tài chính/lịch sử, cây danh mục → `Restrict`; con thuần tuý → `Cascade`).
- Postgres không tự index FK → mọi FK cần `@@index` riêng hoặc là cột dẫn đầu của composite index.
- Composite index theo đúng thứ tự cột filter + sort của query listing; kiểm bằng `EXPLAIN ANALYZE`.

## 3. Migration

Quy trình chuẩn:

1. Sửa `prisma/schema/*.prisma`.
2. `npx prisma migrate dev --create-only --name <ten_thay_doi> --config prisma7.config.ts` — sinh SQL, **chưa** apply.
3. Đọc SQL; thêm tay phần Prisma DSL không biểu diễn được (xem dưới).
4. `npx prisma migrate dev --config prisma7.config.ts` — apply. Prisma v7 **không** tự chạy `generate`/seed → chạy `npx prisma generate --config prisma7.config.ts` nếu cần.

SQL viết tay trong migration (danh sách đầy đủ: `11-database.md` §3.4, §5.2):

```sql
-- Partial unique: mỗi user tối đa 1 giỏ ACTIVE
CREATE UNIQUE INDEX carts_user_active_uq ON carts (user_id) WHERE status = 'ACTIVE';
-- CHECK bất biến một dòng
ALTER TABLE cart_items ADD CONSTRAINT cart_items_quantity_ck CHECK (quantity > 0);
```

Không xoá các câu này ở migration sau: `migrate dev` chỉ diff phần Prisma biết, nhưng luôn đọc lại SQL sinh ra để chắc không có `DROP INDEX` ngoài ý muốn.

Thay đổi an toàn khi đã có dữ liệu thật:

- Thêm cột bắt buộc → kèm `@default(...)`, hoặc thêm nullable → backfill → migration sau mới `NOT NULL`.
- Đổi tên field → giữ cột cũ bằng `@map`, hoặc sửa SQL thành `ALTER TABLE ... RENAME COLUMN` (Prisma mặc định sinh DROP + ADD = mất dữ liệu).
- Đổi kiểu cột / thêm unique trên bảng có dữ liệu → kiểm tra dữ liệu hiện có trước, viết SQL chuyển đổi rõ ràng.
- `migrate dev` chỉ dùng trên máy dev; CI/production dùng `migrate deploy`. Không có rollback tự động — revert bằng migration mới làm ngược lại.

## 4. Prisma Client trong NestJS

- `PrismaModule` là `@Global()` → mọi service inject thẳng `PrismaService`, không tạo client riêng, không thêm Repository layer.
- Chỉ lấy đủ cột cần: `select` khi trả response (tránh lộ `passwordHash`...), `include` khi cần cả quan hệ.

```ts
return this.prisma.product.findUnique({
  where: { id },
  select: { id: true, name: true, variants: { select: { id: true, sku: true, price: true } } },
});
```

- Lỗi Prisma (`P2002` trùng unique, `P2025` không tìm thấy...) để `AllExceptionsFilter` map — xem `error-logging-conventions.md`; chỉ bắt tay khi cần thông điệp nghiệp vụ riêng.
- `BigInt` không serialize JSON trực tiếp — chuyển sang `number`/`string` ở tầng response DTO.

### 4.1. Transaction

Mọi thao tác nhiều bước phải atomic dùng interactive transaction; bên trong chỉ dùng `tx`, không dùng `this.prisma`:

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT id FROM carts WHERE id = ${cartId}::uuid AND status = 'ACTIVE' FOR UPDATE`;
  const order = await tx.order.create({ data });
  await tx.cart.update({ where: { id: cartId }, data: { status: 'CHECKED_OUT' } });
  return order;
});
```

- Mặc định `Read Committed`. Chống race condition ưu tiên **row lock** (`SELECT ... FOR UPDATE` qua `$queryRaw`) và **update có điều kiện** (`updateMany({ where: { id, usedCount: { lt: limit } }, data: { usedCount: { increment: 1 } } })`, kiểm `count`) — thứ tự khoá, quy tắc từng luồng: [`../architecture/04-data-consistency.md`](../architecture/04-data-consistency.md).
- `{ isolationLevel: 'Serializable' }` chỉ khi thực sự cần, kèm retry khi gặp `P2034`.
- Không gọi I/O ngoài (HTTP, email) trong transaction — dùng outbox (`07-async-events-jobs.md`).
- Tăng/giảm số đếm dùng atomic operator (`{ increment: n }`/`{ decrement: n }`), không đọc-rồi-ghi.

### 4.2. Lọc theo quan hệ

```ts
this.prisma.product.findMany({
  where: { status: 'ACTIVE', variants: { some: { status: 'ACTIVE' } } },
});
```

`some` / `every` / `none` cho quan hệ 1-N; `is` / `isNot` cho quan hệ 1-1/N-1.

### 4.3. Phân trang

| Kiểu   | Dùng khi                                          | Cách                                                                                                                  |
| ------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Offset | Admin dashboard, cần nhảy trang, dữ liệu vừa phải | `skip: (page - 1) * limit, take: limit` + `count()` trong `$transaction([...])`                                       |
| Cursor | Listing public lớn, infinite scroll               | `take: limit + 1, cursor: { id }, skip: 1`, `orderBy` có cột duy nhất (vd. `[{ createdAt: 'desc' }, { id: 'desc' }]`) |

`orderBy` phải khớp composite index đã khai cho listing đó.

### 4.4. Tránh N+1

- Không gọi DB trong vòng lặp; dùng `include`/`select` lồng nhau, hoặc gom id rồi `findMany({ where: { id: { in: ids } } })`.
- Nghi ngờ N+1 → bật tạm `log: ['query']` khi khởi tạo client để đếm câu query.

## 5. Seed

- `prisma/seed.ts`, chạy bằng `npm run db:seed` (không tự chạy sau `migrate dev` ở v7).
- Seed phải **idempotent**: dùng `upsert` theo khoá tự nhiên (email, `settings.key`, `sku`) để chạy lại nhiều lần không lỗi/trùng.
- Chỉ seed dữ liệu khởi tạo cần thiết (Master Admin, settings, danh mục tra cứu); dữ liệu demo tách hàm riêng.
- CI chạy `db:seed` trước e2e test.

## 6. Testing

- Unit test service: mock `PrismaService` bằng object chỉ chứa các method service gọi (`vi.fn()`), không kết nối DB.
- E2E (`npm run test:e2e`) chạy trên Postgres thật đã `migrate deploy` + seed; dựng app qua `test/support/create-test-app.ts`, tạo dữ liệu qua helper (`create-test-user.ts`). Mỗi test tự tạo dữ liệu với giá trị unique (email/sku ngẫu nhiên) để không phụ thuộc thứ tự chạy.
- Logic dựa vào ràng buộc DB (partial unique, CHECK, row lock) phải có e2e test — mock không bắt được.

## 7. Lệnh CLI hay dùng

Thêm `--config prisma7.config.ts` cho mọi lệnh dưới đây.

| Lệnh                                            | Mục đích                                          |
| ----------------------------------------------- | ------------------------------------------------- |
| `npx prisma format`                             | Format + kiểm cú pháp schema                      |
| `npx prisma validate`                           | Validate schema                                   |
| `npx prisma generate`                           | Sinh lại Prisma Client vào `src/generated/prisma` |
| `npx prisma migrate dev --create-only --name x` | Sinh SQL migration, chưa apply                    |
| `npx prisma migrate dev`                        | Apply migration đang chờ (máy dev)                |
| `npx prisma migrate deploy`                     | Apply migration ở CI/production                   |
| `npx prisma migrate status`                     | Xem migration nào chưa apply                      |
| `npx prisma migrate reset`                      | Xoá DB dev, apply lại từ đầu (**chỉ máy dev**)    |
| `npx prisma studio`                             | Xem/sửa dữ liệu qua UI                            |
| `npm run db:seed`                               | Chạy seed                                         |
