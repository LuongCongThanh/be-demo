# Hướng dẫn viết `schema.prisma` cho Ecommerce (15 bảng) — theo từng bước

> 📖 Xem [README.md](README.md) để biết vị trí file này trong toàn bộ convention và thứ tự đọc.
>
> Đọc kèm `../ecommerce-postgresql-database-summary.md` (thiết kế: bảng, PK/FK/UK, giả định nghiệp vụ). File này là **quy trình từng bước** để gõ thiết kế đó thành code Prisma thật, theo đúng quy ước Prisma v7 project đang dùng (⚠️ tham chiếu `doc/PLAN.md` bước 14-22 — file này không còn tồn tại, dead link có từ trước, chưa rõ nên trỏ về đâu).
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

| Phần               | Ý nghĩa                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------- |
| `email`            | tên field (dùng trong code TypeScript: `user.email`)                                    |
| `String`           | kiểu dữ liệu Prisma (tương ứng cột `TEXT`/`VARCHAR` bên Postgres)                       |
| `@unique`          | thêm ràng buộc UNIQUE cho cột này                                                       |
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

`enum` giống như kiểu `VARCHAR` nhưng Postgres **tự chặn** giá trị nằm ngoài danh sách — không cần viết `CHECK` tay nữa (đúng vấn đề đã nêu ở review: _"status nên ràng buộc bằng CHECK hoặc ENUM"_).

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
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@map("product_images")
}
```

Không có cột `is_primary`: Cover Image là ảnh có `sort_order` nhỏ nhất (xem `CONTEXT.md`). Bản schema đầu tiên từng có `is_primary` + partial unique index "chỉ 1 ảnh primary / product"; cả hai đã bị bỏ ở migration `20260923120000_drop_product_image_is_primary` vì thứ tự mảng đã đủ để xác định ảnh đại diện.

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

`inventory Inventory?` — có dấu `?` vì quan hệ 1:1 **optional** (1 variant _có thể chưa_ có dòng inventory nào). `cartItems`/`orderItems` là quan hệ ngược 1:N, chưa tồn tại model đích cũng không sao (giống Bước 4).

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

Prisma schema DSL hiện tại **không có cú pháp cho unique index kèm `WHERE`**. Migration `init_ecommerce` ban đầu có 2 chỗ cần (dưới đây); index `product_images_product_id_primary_unique` sau đó đã bị drop cùng cột `is_primary` (xem Bước 7), hiện chỉ còn index của `carts` (đánh dấu `⚠️` ở Bước 10):

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

| #   | Bước | Bảng                        | FK tới                       |
| --- | ---- | --------------------------- | ---------------------------- |
| 1   | 1    | _(enum, không phải bảng)_   | —                            |
| 2   | 3    | `users`                     | —                            |
| 3   | 4    | `categories`                | —                            |
| 4   | 5    | `roles`                     | —                            |
| 5   | 6    | `products`                  | `categories`                 |
| 6   | 7    | `product_images`            | `products`                   |
| 7   | 8    | `product_variants`          | `products`                   |
| 8   | 9    | `inventory`                 | `product_variants`           |
| 9   | 10   | `carts`                     | `users`                      |
| 10  | 11   | `cart_items`                | `carts`, `product_variants`  |
| 11  | 12   | `orders`                    | `users`                      |
| 12  | 13   | `order_items`               | `orders`, `product_variants` |
| 13  | 14   | `user_roles`                | `users`, `roles`             |
| 14  | 15   | `refresh_tokens`            | `users`                      |
| 15  | 16   | `password_reset_tokens`     | `users`                      |
| 16  | 17   | `email_verification_tokens` | `users`                      |
| —   | 18   | _(quay lại vá `User`)_      | —                            |
| —   | 19   | _(2 partial unique index)_  | —                            |
| —   | 20   | _(kiểm tra)_                | —                            |

---

## Phụ lục A — Từ điển toàn bộ từ khoá/keyword Prisma dùng trong file này

Mọi keyword bên dưới đều đã xuất hiện ít nhất 1 lần ở các Bước trên. Tra theo nhóm.

### A.1. Khối khai báo (block-level keyword)

| Keyword            | Ý nghĩa                                                                                                                                                      | Ví dụ trong file                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| `generator client` | Khai báo Prisma tạo ra **Prisma Client** (thư viện TypeScript để code gọi DB) — đã có sẵn đầu file, không đụng vào.                                          | _(không sửa)_                        |
| `datasource db`    | Khai báo DB thật kết nối tới đâu (Postgres, connection string lấy từ `../../.env`) — đã có sẵn đầu file, không đụng vào.                                     | _(không sửa)_                        |
| `model`            | Khai 1 **bảng**. Tên model viết `PascalCase` số ít (`User`), tên bảng thật trong Postgres viết `snake_case` số nhiều (`users`) — nối 2 tên này bằng `@@map`. | `model User { ... }`                 |
| `enum`             | Khai 1 kiểu liệt kê giá trị cố định. Postgres sẽ tạo ra kiểu `ENUM` thật, tự chặn giá trị lạ ở tầng DB (không cần `CHECK` tay).                              | `enum UserStatus { ACTIVE BLOCKED }` |

### A.2. Kiểu dữ liệu field (type)

| Kiểu Prisma                              | Tương ứng Postgres                                             | Dùng khi nào                                                                               |
| ---------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `String`                                 | `TEXT` (hoặc `VARCHAR(n)` nếu thêm `@db.VarChar(n)`)           | chữ, ví dụ `email`, `name`                                                                 |
| `Int`                                    | `INTEGER`                                                      | số nguyên đếm được, ví dụ `quantity`                                                       |
| `Boolean`                                | `BOOLEAN`                                                      | cờ đúng/sai, ví dụ `isPrimary`                                                             |
| `Decimal`                                | `NUMERIC`/`DECIMAL`                                            | **tiền tệ** — bắt buộc, không dùng `Float` vì `Float` có sai số nhị phân khi cộng trừ tiền |
| `DateTime`                               | `TIMESTAMP` (hoặc `TIMESTAMPTZ` nếu thêm `@db.Timestamptz(6)`) | thời điểm, ví dụ `createdAt`                                                               |
| Tên 1 model khác (`Category`, `User`, …) | _(không tạo cột riêng)_                                        | field quan hệ — xem A.4                                                                    |
| `Model[]`                                | _(không tạo cột)_                                              | field quan hệ ngược 1-N, ví dụ `products Product[]`                                        |
| `Kiểu?` (có dấu `?`)                     | cột NULL được                                                  | field optional, ví dụ `description String?`                                                |
| _(không có `?`)_                         | cột `NOT NULL`                                                 | field bắt buộc                                                                             |

### A.3. Attribute gắn trên 1 field (`@...`)

| Attribute                                                    | Ý nghĩa                                                                                                                 | Lưu ý                                                                                                                                                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@id`                                                        | Đánh dấu field này là Primary Key của bảng.                                                                             | Mỗi model chỉ 1 field có `@id` (trừ khi dùng `@@id` composite — xem A.5).                                                                                                                                                                        |
| `@unique`                                                    | Thêm ràng buộc `UNIQUE` cho đúng 1 cột này.                                                                             | Nếu gắn lên field FK (`variantId @unique`) thì biến quan hệ 1-N thành 1-1 (xem Bước 9).                                                                                                                                                          |
| `@default(giá trị)`                                          | Giá trị mặc định khi không truyền lúc tạo record.                                                                       | Có 4 dạng dùng trong file: `@default(uuid())` (sinh UUID **ở phía code Prisma**, không phải Postgres), `@default(now())` (thời điểm tạo record), `@default(0)` / `@default(false)` (số/cờ mặc định), `@default(ACTIVE)` (giá trị enum mặc định). |
| `@updatedAt`                                                 | Prisma **tự** ghi đè field này = thời điểm hiện tại mỗi lần gọi `.update()` — không tự tay gán trong code.              | Chỉ dùng được trên field kiểu `DateTime`.                                                                                                                                                                                                        |
| `@map("ten_cot")`                                            | Đổi tên **cột thật** trong Postgres (field trong code vẫn giữ tên `camelCase`).                                         | Lý do: code TypeScript quy ước `camelCase` (`passwordHash`), Postgres quy ước `snake_case` (`password_hash`).                                                                                                                                    |
| `@db.<KiểuPostgres>`                                         | Ép kiểu cột thật chính xác hơn kiểu Prisma suy ra mặc định.                                                             | Ví dụ: `@db.VarChar(255)` (giới hạn độ dài), `@db.Uuid` (cột UUID thật thay vì text), `@db.Timestamptz(6)` (có timezone, độ chính xác 6 chữ số giây), `@db.Decimal(12, 2)` (tối đa 12 chữ số, 2 số sau dấu phẩy).                                |
| `@relation(fields: [...], references: [...], onDelete: ...)` | Khai field quan hệ (phía "nhiều" của FK): field nào ở bảng này (`fields`) khớp với field nào ở bảng kia (`references`). | Luôn đi kèm 1 field cột FK thật đứng ngay phía trên nó (xem mục 0, cặp `categoryId` / `category`).                                                                                                                                               |

### A.4. Giá trị của `onDelete` trong `@relation`

| Giá trị                   | Hành vi khi xoá record cha                                                                                                                               | Bảng đang dùng trong file                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cascade`                 | Xoá cha → Postgres tự xoá luôn record con.                                                                                                               | `ProductImage→Product`, `ProductVariant→Product`, `Inventory→ProductVariant`, `Cart→User`, `CartItem→Cart`, `UserRole→User/Role`, `RefreshToken/PasswordResetToken/EmailVerificationToken→User` |
| `Restrict`                | Xoá cha bị **chặn** nếu còn con tham chiếu tới (phải xoá/xử lý con trước).                                                                               | `Order→User`, `OrderItem→Order` — vì đơn hàng là hồ sơ tài chính, không được mất khi xoá user                                                                                                   |
| _(không khai — mặc định)_ | Prisma dùng `Restrict` cho quan hệ bắt buộc nếu không khai `onDelete` (tuỳ version); nên **luôn khai rõ tay** như file này làm, đừng phụ thuộc mặc định. | `CartItem→ProductVariant`, `OrderItem→ProductVariant` (cố ý không cho xoá variant còn nằm trong giỏ/đơn)                                                                                        |

### A.5. Attribute gắn ở cuối model (`@@...`, 2 dấu `@`)

| Attribute                                      | Ý nghĩa                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `@@map("ten_bang")`                            | Đổi tên **bảng thật** trong Postgres (model vẫn giữ tên `PascalCase` trong code).                                                          |
| `@@id([field1, field2])`                       | Khai **composite Primary Key** gồm nhiều field cộng lại — dùng khi bảng nối M:N thuần không cần cột `id` riêng (xem `UserRole` ở Bước 14). |
| `@@index([field1, field2, ...])`               | Tạo 1 **composite index** (không phải unique) để tăng tốc truy vấn lọc/sắp theo đúng thứ tự field liệt kê.                                 |
| `field(sort: Desc)` bên trong `@@index([...])` | Chỉ định cột đó sắp giảm dần trong index — khớp với truy vấn `ORDER BY createdAt DESC` (listing "mới nhất trước").                         |

### A.6. Ký hiệu không phải chữ (symbol)

| Ký hiệu                                           | Ý nghĩa                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `?` ngay sau kiểu (`String?`, `DateTime?`)        | Field nullable — cột được phép NULL.                                                                    |
| `[]` ngay sau tên model (`Cart[]`, `OrderItem[]`) | Field quan hệ 1 → nhiều, chỉ tồn tại phía code (không tạo cột), dùng để `.include()` lấy danh sách con. |
| `//`                                              | Comment 1 dòng trong `schema.prisma` (giống TypeScript).                                                |

---

## Phụ lục B — Cách thực hiện: toàn bộ quy trình chạy lệnh, theo đúng thứ tự

Đây là **toàn bộ dòng lệnh** phải chạy, gộp lại từ Bước 19-20, kèm giải thích từng lệnh làm gì và vì sao chạy đúng thứ tự đó.

```bash
# 1) Sau khi đã gõ xong đủ 15 model + 5 enum vào prisma/schema.prisma (Bước 1-18):
npx prisma migrate dev --create-only --name init_ecommerce
```

- `prisma migrate dev` — lệnh chuẩn để: so sánh `schema.prisma` với DB hiện tại → sinh ra file SQL migration mới → áp dụng vào DB → chạy lại `prisma generate`.
- `--create-only` — **chỉ sinh file SQL**, KHÔNG áp dụng vào DB, KHÔNG chạy `generate`. Bắt buộc phải dùng cờ này ở bước này vì bạn cần **sửa tay** file SQL trước khi nó chạy thật (thêm 2 partial unique index mà Prisma schema không viết được).
- `--name init_ecommerce` — đặt tên migration, sẽ ra thư mục `prisma/migrations/<timestamp>_init_ecommerce/`.

```sql
-- 2) Mở prisma/migrations/<timestamp>_init_ecommerce/migration.sql, thêm vào CUỐI file:
CREATE UNIQUE INDEX "carts_user_id_active_unique"
  ON "carts" ("user_id") WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "product_images_product_id_primary_unique"
  ON "product_images" ("product_id") WHERE "is_primary" = true;
```

- Đây là **raw SQL Postgres** thuần, không phải Prisma DSL — vì Prisma schema hiện chưa có cú pháp khai "unique index kèm điều kiện `WHERE`" (partial unique index).
- Phải thêm **sau khi** file migration đã sinh (bước 1), **trước khi** áp dụng migration (bước 3) — nếu làm ngược thứ tự, `--create-only` sẽ không có file nào để sửa, hoặc migration đã chạy rồi thì phải tạo migration mới để thêm 2 dòng này thay vì sửa file cũ.

```bash
# 3) Áp dụng migration thật vào DB (đã bao gồm cả 2 dòng SQL tay ở bước 2):
npx prisma migrate dev
```

- Gọi lại **không có** `--create-only` lần này → Prisma thấy đã có migration file "chờ áp dụng" (từ bước 1, đã sửa ở bước 2) → chạy toàn bộ SQL trong đó vào Postgres → tự chạy `prisma generate` luôn ở cuối.

```bash
# 4) (Thường tự chạy ở bước 3, chạy tay lại nếu cần) sinh lại Prisma Client:
npx prisma generate
```

- Đọc `schema.prisma` → sinh ra code TypeScript (nằm trong `node_modules/.prisma/client` hoặc theo `output` cấu hình) để code NestJS gọi được `prisma.user.findMany()`, `prisma.product.create()`, v.v. Cần chạy lại **mỗi khi** `schema.prisma` đổi.

```bash
# 5) Kiểm tra lại bằng UI:
npx prisma studio
```

- Mở giao diện web (mặc định `http://localhost:5555`) để xem trực tiếp dữ liệu/cấu trúc 15 bảng — dùng để xác nhận bằng mắt là đủ bảng, đúng cột.

```sql
-- 6) Kiểm tra riêng 2 partial unique index (Prisma Studio không hiển thị chi tiết index):
\d carts
\d product_images
```

- `\d <tên_bảng>` là lệnh **của `psql`** (CLI của Postgres, không phải của Prisma) — in ra cấu trúc bảng kèm danh sách toàn bộ index, dùng để xác nhận 2 dòng `CREATE UNIQUE INDEX ... WHERE ...` đã được tạo đúng.

### Tóm tắt thứ tự lệnh (chép nhanh)

| #   | Lệnh                                                         | Chạy ở đâu                 | Mục đích                                     |
| --- | ------------------------------------------------------------ | -------------------------- | -------------------------------------------- |
| 1   | `npx prisma migrate dev --create-only --name init_ecommerce` | terminal, tại root project | sinh file SQL migration, chưa áp dụng        |
| 2   | _(sửa tay file `migration.sql`)_                             | editor                     | thêm 2 partial unique index                  |
| 3   | `npx prisma migrate dev`                                     | terminal                   | áp dụng migration thật vào Postgres          |
| 4   | `npx prisma generate`                                        | terminal                   | sinh lại Prisma Client (thường tự chạy ở #3) |
| 5   | `npx prisma studio`                                          | terminal → mở browser      | xem trực quan dữ liệu/bảng                   |
| 6   | `\d carts`, `\d product_images`                              | trong `psql`               | xác nhận 2 index có `WHERE` clause           |

---

# Phần 2 — Dùng Prisma Client trong NestJS cho Ecommerce

> Nối tiếp sau khi 15 bảng đã tồn tại thật trong DB (hết Bước 20 ở trên). Phần này giả định `PrismaService` + `PrismaModule` (`@Global()`) **đã có sẵn** (⚠️ tham chiếu gốc `doc/PLAN.md` Bước 20 — file này không còn tồn tại, dead link có từ trước) — không tạo lại, mọi domain module bên dưới chỉ **inject** `PrismaService` có sẵn đó.

## Bước 21 — Tổ chức module theo domain, dùng chung 1 `PrismaService`

Nguyên tắc: **1 domain nghiệp vụ = 1 module**, mỗi module chỉ chứa service/controller/DTO của riêng nó, tất cả cùng inject `PrismaService` global — không tạo `PrismaService` riêng cho từng module.

```
src/
  prisma/            ← đã có từ PLAN.md, không đụng vào
  users/             ← User, UserRole, RefreshToken, PasswordResetToken, EmailVerificationToken
  roles/             ← Role
  categories/        ← Category
  products/          ← Product, ProductImage, ProductVariant, Inventory
  carts/             ← Cart, CartItem
  orders/            ← Order, OrderItem
```

Vì sao gộp `RefreshToken`/`PasswordResetToken`/`EmailVerificationToken` vào `users/` thay vì tách module riêng: 3 bảng này chỉ tồn tại **để phục vụ** nghiệp vụ của `User` (đăng nhập/quên mật khẩu/xác thực email), không có nghiệp vụ độc lập nào khác cần tới chúng — tách module riêng chỉ làm phình cấu trúc không cần thiết.

Sinh khung module/service/controller (lặp lại cho từng domain, ví dụ `products`):

```bash
npx nest g module products --no-spec
npx nest g service products --no-spec
npx nest g controller products --no-spec
```

`ProductsService` inject `PrismaService` giống hệt `TodosService` đã làm ở PLAN.md Bước 22:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}
  // ... các method ở Bước 22-26 bên dưới
}
```

> **Không cần thêm 1 lớp "Repository" trung gian** giữa Service và `PrismaService` ở quy mô project này — `PrismaService` **đã là** lớp truy cập DB (Prisma Client tự sinh type-safe query builder), tự viết thêm Repository chỉ bọc lại 1 lớp gọi thẳng, không có lợi ích ở đây. Chỉ cân nhắc Repository pattern khi cần đổi ORM trong tương lai hoặc mock DB access phức tạp hơn `PrismaService` cho phép.

## Bước 22 — CRUD cơ bản: `ProductsService`

```typescript
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ProductCreateInput) {
    return this.prisma.product.create({ data });
  }

  findMany(categoryId?: string) {
    return this.prisma.product.findMany({
      where: { status: 'ACTIVE', ...(categoryId && { categoryId }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.product.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.ProductUpdateInput) {
    return this.prisma.product.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}
```

Từ khoá/kiểu mới xuất hiện:

- `Prisma.ProductCreateInput` / `Prisma.ProductUpdateInput` — Prisma **tự sinh** 2 type này (nằm cùng chỗ export `PrismaClient`, ví dụ `../generated/prisma/client.js`) khớp chính xác các field của model `Product`, dùng làm kiểu tham số cho DTO thay vì tự định nghĩa tay type input.
- `findUnique({ where: { id } })` — chỉ dùng được khi field trong `where` có `@id` hoặc `@unique` (đúng lý do `Inventory.variantId` phải có `@unique` ở Bước 9 — nếu không sẽ phải dùng `findFirst` thay vì `findUnique`).
- `remove()` gọi `.delete()` **không cần tự xoá tay** `ProductImage`/`ProductVariant` con — Postgres tự cascade nhờ `onDelete: Cascade` đã khai ở Bước 7-8.

## Bước 23 — Đọc kèm quan hệ: `include` và `select`

```typescript
findOneWithDetails(id: string) {
  return this.prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      images: { orderBy: { sortOrder: 'asc' } },
      variants: { include: { inventory: true } },
    },
  });
}
```

- `include: { category: true }` — lấy kèm object `Category` cha (field quan hệ `category` khai ở Bước 6), tương đương SQL `JOIN`.
- `include` có thể **lồng nhau** (`variants: { include: { inventory: true } }`) — lấy `Product → variants → inventory` chỉ trong 1 query.
- `select` là **lựa chọn thay thế** cho `include`: dùng khi chỉ cần vài field cụ thể (không lấy nguyên object) để giảm dữ liệu trả về:

```typescript
this.prisma.product.findMany({
  select: { id: true, name: true, category: { select: { name: true } } },
});
```

**Không dùng `include` và `select` cùng lúc trên 1 field** — Prisma báo lỗi nếu lẫn cả hai ở cùng cấp.

## Bước 24 — Ghi nhiều bảng cùng lúc: `$transaction`

Ví dụ nghiệp vụ **checkout**: tạo `Order` + nhiều `OrderItem` + trừ tồn kho `Inventory` + đổi `Cart.status` — **phải cùng thành công hoặc cùng thất bại**, không được để dở dang (ví dụ tạo `Order` xong mà trừ kho lỗi thì đơn hàng bị "ma").

```typescript
async checkout(cartId: string, userId: string) {
  const cart = await this.prisma.cart.findUniqueOrThrow({
    where: { id: cartId },
    include: { items: { include: { variant: true } } },
  });

  return this.prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}`,
        userId,
        totalAmount: cart.items.reduce((sum, i) => sum + Number(i.variant.price) * i.quantity, 0),
        items: {
          create: cart.items.map((i) => ({
            variantId: i.variantId,
            productName: i.variant.sku,
            sku: i.variant.sku,
            quantity: i.quantity,
            unitPrice: i.variant.price,
            totalPrice: Number(i.variant.price) * i.quantity,
          })),
        },
      },
    });

    for (const item of cart.items) {
      await tx.inventory.update({
        where: { variantId: item.variantId },
        data: { quantity: { decrement: item.quantity } },
      });
    }

    await tx.cart.update({ where: { id: cartId }, data: { status: 'CHECKED_OUT' } });

    return order;
  });
}
```

Từ khoá mới:

- `findUniqueOrThrow` — giống `findUnique` nhưng **tự throw exception** (`PrismaClientKnownRequestError` mã `P2025`) nếu không tìm thấy, khỏi phải tự viết `if (!cart) throw ...`.
- `$transaction(async (tx) => { ... })` — dạng **interactive transaction**: mọi lệnh gọi qua `tx.` (không phải `this.prisma.`) bên trong callback này chạy trong **cùng 1 transaction Postgres thật** — nếu bất kỳ lệnh nào bên trong throw lỗi, **toàn bộ tự động rollback**, không cần tự viết `try/catch` + rollback tay.
- `data: { items: { create: [...] } }` — **nested write**: tạo `Order` và toàn bộ `OrderItem` con của nó trong **1 lệnh `create` duy nhất** (Prisma tự lo thứ tự insert đúng để FK hợp lệ), thay vì tách thành nhiều lệnh `create` riêng.
- `{ decrement: item.quantity }` — toán tử **atomic update** ngay tại Postgres (`SET quantity = quantity - $1`), tránh race-condition "đọc số cũ rồi ghi số mới" giữa 2 request chạy đồng thời.

> Có 2 dạng `$transaction`: **interactive** (dùng callback như trên, linh hoạt nhất, dùng khi bước sau cần dùng kết quả bước trước — như ví dụ này) và **sequential** (`$transaction([queryA, queryB])`, truyền mảng query dựng sẵn, dùng khi các lệnh độc lập nhau, Prisma tối ưu chạy nhanh hơn interactive).

## Bước 25 — Lọc nâng cao trên quan hệ: `some` / `every` / `none`

Ví dụ: tìm sản phẩm **còn ít nhất 1 variant còn hàng** (`quantity > 0`):

```typescript
this.prisma.product.findMany({
  where: {
    status: 'ACTIVE',
    variants: { some: { inventory: { quantity: { gt: 0 } } } },
  },
});
```

- `some: {...}` — đúng nếu **ít nhất 1** record quan hệ con khớp điều kiện. `every: {...}` — đúng nếu **tất cả** con khớp. `none: {...}` — đúng nếu **không có con nào** khớp. Cả 3 chỉ dùng được trên field quan hệ kiểu `[]` (1-N), không dùng được trên quan hệ 1-1.
- `gt` (greater than) là 1 trong các toán tử so sánh Prisma hỗ trợ trong `where` cho field số/ngày: `gt`, `gte`, `lt`, `lte`, `not`, `in`, `notIn` — ví dụ `createdAt: { gte: fromDate, lte: toDate }`.
- Kết hợp `OR`/`AND` tay khi cần logic phức tạp hơn: `where: { OR: [{ name: { contains: q } }, { slug: { contains: q } }] }` (`contains` = tìm chuỗi con, thêm `mode: 'insensitive'` để không phân biệt hoa/thường).

## Bước 26 — Phân trang: `skip`/`take` vs cursor

**Offset pagination** (đơn giản, đủ dùng cho admin dashboard ít dữ liệu):

```typescript
this.prisma.product.findMany({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } });
```

Nhược điểm: `skip` càng lớn thì Postgres càng phải quét bỏ qua càng nhiều dòng — chậm dần khi dữ liệu lớn.

**Cursor pagination** (khuyến nghị cho listing sản phẩm công khai, khớp với `@@index([categoryId, status, createdAt(sort: Desc)])` đã khai ở Bước 6):

```typescript
this.prisma.product.findMany({
  where: { categoryId, status: 'ACTIVE' },
  orderBy: { createdAt: 'desc' },
  take: pageSize,
  ...(lastSeenId && { cursor: { id: lastSeenId }, skip: 1 }),
});
```

- `cursor: { id: lastSeenId }` — bắt đầu lấy dữ liệu **ngay sau** record có `id` này (record cuối của trang trước) — Postgres seek thẳng tới vị trí đó bằng index, không quét từ đầu.
- `skip: 1` — bỏ qua chính record cursor (đã hiển thị ở trang trước), lấy `pageSize` record **tiếp theo**.

## Bước 27 — Viết `../../prisma/seed.ts` đầy đủ cho 15 bảng có quan hệ

Nguyên tắc thứ tự **giống hệt** thứ tự tạo model ở mục 2 (cha trước, con sau) — vì `createMany`/`create` sẽ báo lỗi FK nếu bảng cha chưa có dữ liệu.

```typescript
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // 1) Bảng gốc — dùng upsert để chạy seed lại nhiều lần không bị lỗi trùng unique
  const admin = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  const category = await prisma.category.upsert({
    where: { slug: 'ao-thun' },
    update: {},
    create: { name: 'Áo thun', slug: 'ao-thun' },
  });

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: { email: 'demo@example.com', passwordHash: 'demo-hash-only' },
  });

  // 2) Bảng nối M:N — @@id composite nên where phải truyền đúng tên khoá kép
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: admin.id } },
    update: {},
    create: { userId: user.id, roleId: admin.id },
  });

  // 3) Bảng phụ thuộc sâu hơn — dùng nested create để tạo Product + Variant + Inventory 1 lần
  await prisma.product.create({
    data: {
      categoryId: category.id,
      name: 'Áo thun basic',
      slug: 'ao-thun-basic',
      variants: {
        create: [
          {
            sku: 'AOTB-M-BLACK',
            color: 'black',
            size: 'M',
            price: 199000,
            inventory: { create: { quantity: 100 } },
          },
        ],
      },
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

Từ khoá mới:

- `upsert({ where, update, create })` — "update nếu đã tồn tại, create nếu chưa" trong **1 lệnh** — bắt buộc dùng cho bất kỳ dữ liệu seed nào có field `@unique`, để chạy `npx prisma db seed` lại nhiều lần **không bị lỗi** `Unique constraint failed`.
- `userId_roleId: { userId, roleId }` — tên field tổng hợp Prisma **tự đặt** cho composite key khai bằng `@@id([userId, roleId])` (Bước 14): ghép 2 tên field bằng dấu `_`, dùng làm key trong `where` khi 1 model không có field `id` đơn.
- `variants: { create: [{ ..., inventory: { create: {...} } }] }` — nested create **3 tầng** (`Product → ProductVariant → Inventory`) trong 1 lệnh `.create()` duy nhất, Prisma tự đảm bảo thứ tự insert đúng theo FK.

Chạy seed (đã khai `seed` trong `prisma.config.ts` ở PLAN.md Bước 22 phần mở rộng):

```bash
npx prisma db seed
```

## Bước 28 — Sửa schema an toàn sau khi đã có dữ liệu thật

| Tình huống                                             | Cách làm an toàn                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thêm cột **bắt buộc** (`NOT NULL`) vào bảng đã có data | Không thêm thẳng field không có `?` và không có `@default(...)` — `migrate dev` sẽ hỏi giá trị mặc định cho các dòng cũ hoặc lỗi nếu chạy `migrate deploy`. Luôn thêm kèm `@default(...)` hoặc để `?` trước, sau này muốn bắt buộc thì tách thành 2 migration (thêm cột nullable → backfill data → đổi thành NOT NULL).                 |
| Đổi tên field                                          | Sửa tên trong `schema.prisma` **kèm** `@map("ten_cot_cu")` nếu muốn giữ nguyên tên cột thật (tránh Prisma tạo migration `DROP COLUMN` + `ADD COLUMN` làm mất data) — hoặc chấp nhận migration rename thật (`ALTER TABLE ... RENAME COLUMN`) bằng cách sửa tay file SQL sinh ra trước khi apply, giống cách làm partial index ở Bước 19. |
| Xoá cột/bảng không dùng nữa                            | Chạy `--create-only` trước, đọc kỹ SQL sinh ra (`DROP COLUMN`/`DROP TABLE`) để chắc chắn không xoá nhầm bảng đang có data quan trọng, rồi mới apply.                                                                                                                                                                                    |
| Đổi kiểu FK / thắt chặt ràng buộc                      | Kiểm tra data cũ có vi phạm ràng buộc mới không **trước khi** apply (ví dụ thêm `@unique` vào cột đang có giá trị trùng sẽ làm migration fail giữa chừng).                                                                                                                                                                              |

Lệnh hữu ích khi thao tác migration:

```bash
npx prisma migrate status      # xem migration nào đã/chưa apply vào DB đang kết nối
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma
npx prisma migrate deploy      # dùng ở production/CI — CHỈ áp dụng migration có sẵn, không tự sinh migration mới, không hỏi tương tác
```

- `migrate dev` chỉ dùng ở **máy dev** (có thể tự sinh migration mới, tự hỏi tương tác); `migrate deploy` mới là lệnh dùng khi **deploy thật** (production/CI) — không bao giờ chạy `migrate dev` trên production.
- Prisma **không có lệnh "rollback" tự động** cho 1 migration đã apply — muốn revert thì viết 1 migration **mới** làm ngược lại thay đổi đó (ví dụ migration thêm cột thì migration revert là `DROP COLUMN` cột đó), không sửa/xoá file migration cũ đã apply.

## Bước 29 — Test service dùng Prisma

**Unit test** (mock toàn bộ `PrismaService`, không đụng DB thật — nhanh, dùng cho logic nghiệp vụ):

```typescript
import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProductsService } from './products.service.js';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: mockDeep<PrismaService>() }],
    }).compile();

    service = module.get(ProductsService);
    prisma = module.get(PrismaService);
  });

  it('findOne trả về sản phẩm theo id', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: '1', name: 'Áo' } as any);
    await expect(service.findOne('1')).resolves.toEqual({ id: '1', name: 'Áo' });
  });
});
```

- `mockDeep<PrismaService>()` (package `jest-mock-extended`) — tự sinh mock cho **toàn bộ** method lồng nhau của Prisma Client (`prisma.product.findUnique`, `prisma.order.create`, …) mà không cần tự viết tay từng hàm giả.
- Test này **không cần Postgres chạy thật** — chạy được trong CI không có DB.

**Integration test** (dùng DB test thật, kiểm tra query/transaction/constraint hoạt động đúng):

```bash
# .env.test trỏ tới 1 database Postgres riêng (KHÔNG dùng chung DB dev)
npx dotenv -e .env.test -- npx prisma migrate deploy   # apply toàn bộ migration vào DB test
npx dotenv -e .env.test -- jest --config jest.integration.config.ts
```

- Mỗi lần chạy: **reset về trạng thái sạch** trước khi test bằng `npx prisma migrate reset --force --skip-seed` (xoá sạch data + apply lại migration), tránh test trước ảnh hưởng test sau.
- Không dùng chung database dev/production cho integration test — luôn dùng DB/schema riêng để `migrate reset` không xoá nhầm data thật.

## Bước 30 — Tránh N+1 query & đo hiệu năng

**N+1 problem** — lỗi hiệu năng phổ biến nhất khi mới dùng ORM:

```typescript
// ❌ SAI — 1 query lấy list + N query lấy category cho từng product (N+1)
const products = await this.prisma.product.findMany();
for (const p of products) {
  const category = await this.prisma.category.findUnique({ where: { id: p.categoryId } });
}

// ✅ ĐÚNG — 1 query duy nhất, Prisma tự JOIN
const products = await this.prisma.product.findMany({ include: { category: true } });
```

Bật log để tự đếm số query thật sự chạy xuống Postgres (sửa `PrismaService` ở PLAN.md Bước 20, thêm option `log`):

```typescript
super({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  log: ['query'],
});
```

`log: ['query']` in ra **mọi câu SQL thật** Prisma gửi xuống Postgres kèm thời gian chạy — dùng để phát hiện chỗ nào đang bị N+1 (thấy nhiều dòng log lặp lại cùng 1 câu SQL chỉ khác tham số).

Kiểm tra index có được dùng không bằng `psql`:

```sql
EXPLAIN ANALYZE
SELECT * FROM products WHERE category_id = '...' AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 20;
```

Nếu kết quả hiện `Index Scan using products_category_id_status_created_at_idx` (đúng tên index sinh ra từ `@@index` ở Bước 6) → tốt. Nếu hiện `Seq Scan` (quét toàn bảng) dù đã có `@@index` → kiểm tra lại đúng thứ tự field trong `where`/`orderBy` có khớp đúng thứ tự khai trong `@@index` không (Postgres composite index chỉ tối ưu tốt khi dùng đúng thứ tự cột từ trái sang).

## Bước 31 — Transaction isolation level (khi cần chặt hơn mặc định)

Mặc định Postgres/Prisma dùng mức `Read Committed` — đủ cho hầu hết nghiệp vụ, nhưng **không tự chặn** 2 request checkout cùng lúc cùng đọc thấy `quantity = 1` rồi cùng trừ kho (oversell). Khi cần chặt hơn:

```typescript
await this.prisma.$transaction(
  async (tx) => {
    /* ...logic checkout Bước 24... */
  },
  { isolationLevel: 'Serializable' },
);
```

- `isolationLevel: 'Serializable'` — Postgres đảm bảo hành vi giống như các transaction chạy **lần lượt tuyệt đối**, không transaction nào thấy được thay đổi "nửa chừng" của transaction khác — transaction thua sẽ tự **fail và cần retry** (bọc thêm logic `try/catch` + retry hữu hạn lần khi gặp lỗi `P2034`).
- Cân nhắc đánh đổi: `Serializable` an toàn nhất nhưng **chậm hơn** và có thể phải retry — chỉ dùng cho đúng chỗ có rủi ro race-condition thật (trừ kho, giữ chỗ), không áp dụng tràn lan cho mọi transaction.
