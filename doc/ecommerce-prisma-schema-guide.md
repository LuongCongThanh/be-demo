# Hướng dẫn viết `schema.prisma` cho Ecommerce (15 bảng) — theo từng bước

> Đọc kèm `ecommerce-postgresql-database-summary.md` (thiết kế: bảng, PK/FK/UK, giả định nghiệp vụ). File này là **quy trình từng bước** để gõ thiết kế đó thành code Prisma thật, theo đúng quy ước Prisma v7 project đang dùng (xem `doc/PLAN.md` bước 14-22).
>
> Không có bước nào tôi chạy hộ — bạn tự gõ/copy và tự chạy lệnh.

---

## 0. Tạo file ở đâu, tạo "biến" nghĩa là gì

**Không tạo file mới.** File đã có sẵn: `prisma/schema.prisma` (hiện đang có model `Todo`). Bạn mở file này, cuộn xuống cuối, và **thêm nối tiếp** các đoạn code ở các Bước bên dưới vào cuối file — không sửa `generator client` / `datasource db` đang có ở đầu file.

Prisma không gọi là "biến" — gọi là **field** (nằm trong 1 **model** = 1 bảng). Cấu trúc chung của 1 field:

```
<tên field>  <kiểu dữ liệu><?>   <các @attribute>
```

Ví dụ đọc từng phần của dòng `email String @unique @db.VarChar(255)`:

| Phần | Ý nghĩa |
|---|---|
| `email` | tên field (dùng trong code TypeScript: `user.email`) |
| `String` | kiểu dữ liệu Prisma (tương ứng cột `TEXT`/`VARCHAR` bên Postgres) |
| `@unique` | thêm ràng buộc UNIQUE cho cột này |
| `@db.VarChar(255)` | ép kiểu cột thật trong Postgres là `VARCHAR(255)` (không thì Prisma mặc định ra `TEXT`) |

Nếu field là **nullable** (được phép NULL), thêm dấu `?` ngay sau kiểu:
```
revokedAt DateTime? @map("revoked_at") @db.Timestamptz(6)
```
`DateTime?` = cột này có thể NULL. Không có `?` = bắt buộc phải có giá trị (NOT NULL).

Field kiểu **quan hệ** (FK) luôn đi theo **cặp 2 dòng**:
```
categoryId String   @map("category_id") @db.Uuid        // 1. cột FK thật (lưu UUID)
category   Category @relation(fields: [categoryId], references: [id])  // 2. field quan hệ (dùng để .include() trong code)
```
Dòng 1 là cột thật nằm trong DB. Dòng 2 **không tạo cột nào cả** — nó chỉ khai báo với Prisma "field `category` được nối từ `categoryId` sang `Category.id`", để code gọi `product.category` lấy được object Category liên quan.

---

## 1. Enum — khai báo trước tiên, vì các bảng ở Bước 2 trở đi sẽ dùng tới

Thêm khối này vào cuối `prisma/schema.prisma` (thứ tự enum không quan trọng, nhưng để đầu cho dễ tìm):

```prisma
enum UserStatus {
  ACTIVE
  BLOCKED
}

enum ProductStatus {
  ACTIVE
  INACTIVE
}

enum VariantStatus {
  ACTIVE
  INACTIVE
}

enum CartStatus {
  ACTIVE
  CHECKED_OUT
}

enum OrderStatus {
  PENDING
  PAID
  CANCELLED
}
```

`enum` giống như kiểu `VARCHAR` nhưng Postgres **tự chặn** giá trị nằm ngoài danh sách — không cần viết `CHECK` tay nữa (đúng vấn đề đã nêu ở review: *"status nên ràng buộc bằng CHECK hoặc ENUM"*).

---

## 2. Thứ tự tạo bảng: bảng **không phụ thuộc ai** trước, bảng **phụ thuộc** sau

Nguyên tắc chọn thứ tự: bảng nào **không có FK trỏ đi đâu cả** thì viết trước; bảng nào **có FK** thì viết sau bảng nó trỏ tới — để lúc đọc lại code, bạn luôn thấy "cha" đã được định nghĩa trước "con".

> Lưu ý: Prisma **không bắt buộc** thứ tự này (không giống raw SQL, Prisma tự resolve quan hệ dù model nào viết trước) — nhưng viết theo đúng thứ tự phụ thuộc giúp đọc code dễ hiểu hơn nhiều, nên tài liệu này vẫn theo thứ tự đó.

Thứ tự 15 bảng:

```
1.  users                        ← gốc, không FK
2.  categories                   ← gốc, không FK
3.  roles                        ← gốc, không FK
4.  products                     ← FK → categories
5.  product_images                ← FK → products
6.  product_variants              ← FK → products
7.  inventory                    ← FK → product_variants
8.  carts                        ← FK → users
9.  cart_items                   ← FK → carts, product_variants
10. orders                       ← FK → users
11. order_items                  ← FK → orders, product_variants
12. user_roles                   ← FK → users, roles
13. refresh_tokens                ← FK → users
14. password_reset_tokens         ← FK → users
15. email_verification_tokens     ← FK → users
```

Làm lần lượt theo đúng thứ tự trên, từ Bước 3 tới Bước 17 bên dưới.

---

## Bước 3 — `users` (bảng #1, gốc)

```prisma
model User {
  id              String     @id @default(uuid()) @db.Uuid
  email           String     @unique @db.VarChar(255)
  passwordHash    String     @map("password_hash")
  fullName        String?    @map("full_name") @db.VarChar(255)
  phone           String?    @db.VarChar(30)
  status          UserStatus @default(ACTIVE)
  emailVerifiedAt DateTime?  @map("email_verified_at") @db.Timestamptz(6)
  createdAt       DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime   @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@map("users")
}
```

Giải thích các dòng mới gặp lần đầu:
- `@id` — đánh dấu `id` là Primary Key.
- `@default(uuid())` — Prisma tự sinh UUID v4 mỗi lần tạo record mới (sinh ở phía code, không phải trong Postgres).
- `@updatedAt` — Prisma tự set lại giá trị này = thời điểm hiện tại mỗi lần `update()`, không cần tự gán tay (giống hệt cách `Todo.updatedAt` đang làm ở model có sẵn).
- `@@map("users")` — đặt ở **cuối model** (không phải trên 1 field), khai tên bảng thật trong Postgres là `users` (model tên `User`, bảng tên `users` — khác nhau, đúng theo mục 1 của guide).

Chưa có field `carts`/`orders`/... ở model `User` vội — sẽ **quay lại thêm vào cuối** ở Bước 18, sau khi các model kia đã tồn tại (Prisma cần biết `Cart`, `Order` là gì trước khi `User` có thể khai `carts Cart[]`).

## Bước 4 — `categories` (bảng #2, gốc)

```prisma
model Category {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @db.VarChar(150)
  slug        String   @unique @db.VarChar(150)
  description String?
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  products Product[]

  @@map("categories")
}
```

Khác với `User` ở Bước 3: `categories` có thể khai `products Product[]` **ngay bây giờ** dù `Product` chưa được viết — vì Prisma đọc toàn bộ file trước khi kiểm tra, model nào đứng trước hay sau trong file không quan trọng với việc này. (Ở Bước 3 tôi cố ý **chưa** viết `carts Cart[]` chỉ để bạn thấy rõ luồng "viết dần" theo từng bước — không phải vì Prisma bắt buộc.)

`products Product[]` là field quan hệ **ngược chiều** (không phải FK, không tạo cột nào ở `categories`) — nó cho code gọi được `category.products` (danh sách product thuộc category này).

## Bước 5 — `roles` (bảng #3, gốc)

```prisma
model Role {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @unique @db.VarChar(50)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  userRoles UserRole[]

  @@map("roles")
}
```

## Bước 6 — `products` (bảng #4, FK → `categories`)

```prisma
model Product {
  id          String        @id @default(uuid()) @db.Uuid
  categoryId  String        @map("category_id") @db.Uuid
  name        String        @db.VarChar(255)
  slug        String        @unique @db.VarChar(255)
  description String?
  status      ProductStatus @default(ACTIVE)
  createdAt   DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime      @updatedAt @map("updated_at") @db.Timestamptz(6)

  category Category         @relation(fields: [categoryId], references: [id])
  images   ProductImage[]
  variants ProductVariant[]

  @@index([categoryId, status, createdAt(sort: Desc)])
  @@map("products")
}
```

Field FK đầu tiên xuất hiện — đọc kỹ cặp `categoryId` / `category`:
- `categoryId String @map("category_id") @db.Uuid` — **cột thật**, lưu UUID của category cha.
- `category Category @relation(fields: [categoryId], references: [id])` — khai với Prisma: field `category` được nối bằng cách lấy `categoryId` (ở bảng này) so khớp với `id` (ở bảng `Category`).

`@@index([categoryId, status, createdAt(sort: Desc)])` — composite index phục vụ phân trang/listing (đã bàn ở mục 3 file thiết kế): lọc theo category + status, sắp mới nhất trước.

## Bước 7 — `product_images` (bảng #5, FK → `products`)

```prisma
model ProductImage {
  id        String   @id @default(uuid()) @db.Uuid
  productId String   @map("product_id") @db.Uuid
  url       String
  altText   String?  @map("alt_text") @db.VarChar(255)
  sortOrder Int      @default(0) @map("sort_order")
  isPrimary Boolean  @default(false) @map("is_primary")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@map("product_images")
  // ⚠️ "chỉ 1 is_primary=true / product" là PARTIAL UNIQUE INDEX,
  //    Prisma schema KHÔNG viết được — xem Bước 18 "Việc Prisma không tự làm được".
}
```

`onDelete: Cascade` — thêm vào bên trong `@relation(...)`, nghĩa là: xoá 1 `Product` thì Postgres tự xoá luôn các `ProductImage` con của nó, không cần code tự xoá tay từng ảnh.

## Bước 8 — `product_variants` (bảng #6, FK → `products`)

```prisma
model ProductVariant {
  id        String        @id @default(uuid()) @db.Uuid
  productId String        @map("product_id") @db.Uuid
  sku       String        @unique @db.VarChar(100)
  color     String?       @db.VarChar(50)
  size      String?       @db.VarChar(50)
  price     Decimal       @db.Decimal(12, 2)
  status    VariantStatus @default(ACTIVE)
  createdAt DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime      @updatedAt @map("updated_at") @db.Timestamptz(6)

  product    Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  inventory  Inventory?
  cartItems  CartItem[]
  orderItems OrderItem[]

  @@index([productId, createdAt(sort: Desc)])
  @@map("product_variants")
}
```

`price Decimal @db.Decimal(12, 2)` — **không** dùng `Float` cho tiền, luôn dùng `Decimal` (tránh sai số thập phân khi cộng trừ giá tiền).

`inventory Inventory?` — có dấu `?` vì quan hệ 1:1 **optional** (1 variant *có thể chưa* có dòng inventory nào). `cartItems`/`orderItems` là quan hệ ngược 1:N, chưa tồn tại model đích cũng không sao (giống Bước 4).

## Bước 9 — `inventory` (bảng #7, FK → `product_variants`)

```prisma
model Inventory {
  id               String   @id @default(uuid()) @db.Uuid
  variantId        String   @unique @map("variant_id") @db.Uuid
  quantity         Int      @default(0)
  reservedQuantity Int      @default(0) @map("reserved_quantity")
  updatedAt        DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  variant ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@map("inventory")
}
```

`variantId String @unique` — chính dấu `@unique` này (thay vì để trống) là thứ biến quan hệ 1:N thường thành quan hệ **1:1** trong Prisma: vì mỗi `variantId` chỉ được xuất hiện tối đa 1 lần ở bảng `inventory`, nên 1 variant không thể có 2 dòng inventory.

## Bước 10 — `carts` (bảng #8, FK → `users`)

```prisma
model Cart {
  id        String     @id @default(uuid()) @db.Uuid
  userId    String     @map("user_id") @db.Uuid
  status    CartStatus @default(ACTIVE)
  createdAt DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime   @updatedAt @map("updated_at") @db.Timestamptz(6)

  user  User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  items CartItem[]

  @@map("carts")
  // ⚠️ "1 ACTIVE cart / user" là PARTIAL UNIQUE INDEX — xem Bước 18.
}
```

## Bước 11 — `cart_items` (bảng #9, FK → `carts` + `product_variants`)

```prisma
model CartItem {
  id        String   @id @default(uuid()) @db.Uuid
  cartId    String   @map("cart_id") @db.Uuid
  variantId String   @map("variant_id") @db.Uuid
  quantity  Int
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  cart    Cart           @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variant ProductVariant @relation(fields: [variantId], references: [id])

  @@index([cartId])
  @@map("cart_items")
}
```

Bảng đầu tiên có **2 FK cùng lúc** — chỉ cần lặp lại đúng khuôn "field cột thật + field quan hệ" cho từng FK, không có gì khác biệt so với 1 FK.

## Bước 12 — `orders` (bảng #10, FK → `users`)

```prisma
model Order {
  id          String      @id @default(uuid()) @db.Uuid
  orderNumber String      @unique @map("order_number") @db.VarChar(30)
  userId      String      @map("user_id") @db.Uuid
  status      OrderStatus @default(PENDING)
  totalAmount Decimal     @map("total_amount") @db.Decimal(12, 2)
  createdAt   DateTime    @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime    @updatedAt @map("updated_at") @db.Timestamptz(6)

  user  User        @relation(fields: [userId], references: [id], onDelete: Restrict)
  items OrderItem[]

  @@index([userId, createdAt(sort: Desc)])
  @@index([status, createdAt(sort: Desc)])
  @@map("orders")
}
```

`onDelete: Restrict` — **khác** với `carts` (là `Cascade`) — đúng quyết định đã chốt: đơn hàng là hồ sơ tài chính, xoá user không được kéo theo xoá đơn hàng.

## Bước 13 — `order_items` (bảng #11, FK → `orders` + `product_variants`)

```prisma
model OrderItem {
  id          String   @id @default(uuid()) @db.Uuid
  orderId     String   @map("order_id") @db.Uuid
  variantId   String   @map("variant_id") @db.Uuid
  productName String   @map("product_name") @db.VarChar(255)
  sku         String   @db.VarChar(100)
  quantity    Int
  unitPrice   Decimal  @map("unit_price") @db.Decimal(12, 2)
  totalPrice  Decimal  @map("total_price") @db.Decimal(12, 2)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  order   Order          @relation(fields: [orderId], references: [id], onDelete: Restrict)
  variant ProductVariant @relation(fields: [variantId], references: [id])

  @@index([orderId])
  @@map("order_items")
}
```

## Bước 14 — `user_roles` (bảng #12, FK → `users` + `roles`, **không có `id`**)

```prisma
model UserRole {
  userId    String   @map("user_id") @db.Uuid
  roleId    String   @map("role_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("user_roles")
}
```

Khác biệt duy nhất so với các bảng trước: **không có field `id`**. Thay vì `@id` gắn trên 1 field, PK ở đây là `@@id([userId, roleId])` viết riêng 1 dòng ở cuối model — đúng thiết kế "composite PK, không cần surrogate key" (vì đây là bảng nối M:N thuần).

## Bước 15 — `refresh_tokens` (bảng #13, FK → `users`)

```prisma
model RefreshToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamptz(6)
  revokedAt DateTime? @map("revoked_at") @db.Timestamptz(6)
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("refresh_tokens")
}
```

## Bước 16 — `password_reset_tokens` (bảng #14, FK → `users`)

```prisma
model PasswordResetToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamptz(6)
  usedAt    DateTime? @map("used_at") @db.Timestamptz(6)
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("password_reset_tokens")
}
```

## Bước 17 — `email_verification_tokens` (bảng #15, FK → `users`)

```prisma
model EmailVerificationToken {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  tokenHash  String    @unique @map("token_hash")
  expiresAt  DateTime  @map("expires_at") @db.Timestamptz(6)
  verifiedAt DateTime? @map("verified_at") @db.Timestamptz(6)
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("email_verification_tokens")
}
```

Tới đây **cả 15 model đã được viết**. Bước cuối là quay lại vá field quan hệ ngược còn thiếu ở `User` (đã cố ý bỏ trống từ Bước 3).

## Bước 18 — Quay lại `User`, thêm các field quan hệ ngược

Mở lại `model User` đã viết ở Bước 3, sửa thành:

```prisma
model User {
  id              String     @id @default(uuid()) @db.Uuid
  email           String     @unique @db.VarChar(255)
  passwordHash    String     @map("password_hash")
  fullName        String?    @map("full_name") @db.VarChar(255)
  phone           String?    @db.VarChar(30)
  status          UserStatus @default(ACTIVE)
  emailVerifiedAt DateTime?  @map("email_verified_at") @db.Timestamptz(6)
  createdAt       DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime   @updatedAt @map("updated_at") @db.Timestamptz(6)

  carts                   Cart[]
  orders                  Order[]
  userRoles               UserRole[]
  refreshTokens           RefreshToken[]
  passwordResetTokens     PasswordResetToken[]
  emailVerificationTokens EmailVerificationToken[]

  @@map("users")
}
```

Đây là bước duy nhất phải **sửa lại** model đã viết trước đó — vì `User` là bảng bị nhiều bảng khác FK tới nhất (7 bảng), nên các field quan hệ ngược của nó dồn hết vào bước cuối cho gọn quy trình, thay vì phải nhớ quay lại sửa rải rác qua từng bước.

---

## Bước 19 — Việc Prisma không tự viết được: 2 partial unique index

Prisma schema DSL hiện tại **không có cú pháp cho unique index kèm `WHERE`**. Có đúng 2 chỗ cần (đã đánh dấu `⚠️` ở Bước 7 và Bước 10):

```bash
# Tạo file migration nhưng CHƯA áp dụng vào DB
npx prisma migrate dev --create-only --name init_ecommerce
```

Mở file `prisma/migrations/<timestamp>_init_ecommerce/migration.sql` vừa tạo, thêm 2 dòng vào **cuối file**:

```sql
CREATE UNIQUE INDEX "carts_user_id_active_unique"
  ON "carts" ("user_id") WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "product_images_product_id_primary_unique"
  ON "product_images" ("product_id") WHERE "is_primary" = true;
```

Rồi mới áp dụng migration thật:

```bash
npx prisma migrate dev
npx prisma generate
```

> 2 index này không có mặt trong `schema.prisma` nên Prisma sẽ không đụng vào chúng ở các lần `migrate dev` sau — chỉ cần nhớ **không xoá dòng SQL đó** nếu sau này bạn dọn dẹp lịch sử migration.

## Bước 20 — Kiểm tra lại

```bash
npx prisma studio
```

Xác nhận đủ 15 bảng. Muốn xem index có đúng `WHERE` clause không, mở `psql`:

```sql
\d carts
\d product_images
```

---

## Tóm tắt thứ tự (chép nhanh)

| # | Bước | Bảng | FK tới |
|---|---|---|---|
| 1 | 1 | *(enum, không phải bảng)* | — |
| 2 | 3 | `users` | — |
| 3 | 4 | `categories` | — |
| 4 | 5 | `roles` | — |
| 5 | 6 | `products` | `categories` |
| 6 | 7 | `product_images` | `products` |
| 7 | 8 | `product_variants` | `products` |
| 8 | 9 | `inventory` | `product_variants` |
| 9 | 10 | `carts` | `users` |
| 10 | 11 | `cart_items` | `carts`, `product_variants` |
| 11 | 12 | `orders` | `users` |
| 12 | 13 | `order_items` | `orders`, `product_variants` |
| 13 | 14 | `user_roles` | `users`, `roles` |
| 14 | 15 | `refresh_tokens` | `users` |
| 15 | 16 | `password_reset_tokens` | `users` |
| 16 | 17 | `email_verification_tokens` | `users` |
| — | 18 | *(quay lại vá `User`)* | — |
| — | 19 | *(2 partial unique index)* | — |
| — | 20 | *(kiểm tra)* | — |
