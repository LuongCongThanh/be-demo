# Auth & Authorization — Engineering Playbook

> Nguồn: buổi grilling review `../module-auth.md` ngày 2026-09-11, đối chiếu với `prisma/schema.prisma` và `../convention/api-conventions.md`.
> File này là **playbook thực thi** — đủ ngữ cảnh để một dev (hoặc AI coding agent) nhận task và làm tuần tự mà ít phải hỏi lại. Mỗi step trong [4. Implementation Steps](#4-implementation-steps) đi theo cùng một khuôn: **Goal → Files → CLI → Implementation → Acceptance Criteria → Tests** — đọc step, chạy CLI, code, test, check AC, sang step tiếp theo.
> Glossary domain nằm ở `CONTEXT.md`, quy ước code chung nằm ở `../convention/api-conventions.md`.

---

## Progress Snapshot

> Cập nhật lần cuối: 2026-09-11, sau khi audit lại toàn bộ repo. **Đây là phần duy nhất trong file cần cập nhật liên tục khi code tiến triển** — 10 phần còn lại (Scope, Decisions, Architecture...) là spec/thiết kế, không đổi theo tiến độ.

**Chú giải trạng thái:**

- 🔴 **Chưa làm** — chưa có file/logic nào cho step này.
- 🟡 **Đã scaffold (rỗng)** — file đã được tạo (thường qua `nest g`) nhưng chưa có logic thật, hoặc trùng hợp có sẵn nội dung không liên quan (cần thay thế, không phải "đã xong" nên bỏ qua).
- 🟢 **Đã xong** — có logic thật + đúng Acceptance Criteria của step.

**Tình trạng hiện tại (audit ngày 2026-09-11): 0/26 step đã xong, 25/26 chưa làm, 1/26 có trùng hợp một phần (STEP 24).** Chưa có bất kỳ file nào dưới `../../src/auth` hay `src/mail/`, `../../package.json` chưa cài package nào ở STEP 2, `app.module.ts` chưa import `AuthModule`/`MailModule`.

> ⚠️ **Đang cập nhật lại format (2026-09-14):** STEP 5 (Register) đã được tách thành 6 step con (STEP 5.1 → 5.6), mỗi step con làm đúng 1 việc và có Acceptance Criteria riêng — xem [4. Implementation Steps](#4-implementation-steps). Việc tách chỉ đổi **cách trình bày**, không đổi tiến độ thực tế: cả 6 step con vẫn đang 🔴 **Chưa làm**. Tổng số step sẽ được đếm lại chính xác sau khi toàn bộ playbook (STEP 6 → 24, A, B) được viết lại theo cùng format.

⚠️ **Lưu ý quan trọng — đừng nhầm "file đã tồn tại" với "step đã xong":**

- `../../prisma/seed.ts` **đã tồn tại** nhưng là seed script cũ của app Todo (`prisma.todo.createMany(...)`) — không có logic seed role/admin nào. STEP 1 vẫn là 🔴 **Chưa làm** — xem ghi chú chi tiết ngay trong STEP 1 bên dưới.
- `../module-auth.md` **đã có sẵn** dòng `POST /auth/logout-all` trong bảng API (mục 26) — nhưng đây là **trùng hợp từ nội dung gốc**, không phải kết quả STEP 24. 5/6 hạng mục còn lại của STEP 24 (admin bootstrap, reuse detection, 2 trục trạng thái, password policy, ownership guard note) vẫn chưa có. Xem ghi chú trong STEP 24.
- `../../prisma/schema.prisma` đã sẵn sàng đúng như playbook giả định (User/Role/UserRole/RefreshToken/PasswordResetToken/EmailVerificationToken) — nhưng đây là **schema có từ trước playbook**, không tính là một step đã hoàn thành.

---

## 1. Scope & Goal

Tài liệu này mô tả cách implement **Authentication & Authorization MVP** cho ecommerce backend.

### Bao gồm

- Register
- Email verification
- Resend verification
- Login
- Access token
- Refresh token rotation
- Refresh token reuse detection
- Logout
- Logout all devices
- Forgot password
- Reset password
- JWT authentication (`JwtAuthGuard`)
- Role-based authorization (`RolesGuard` + `@Roles()`)
- Ownership authorization (`OwnershipGuard`)
- Rate limiting (các endpoint nhạy cảm)
- Unit test / E2E test
- Swagger/OpenAPI

### Không bao gồm (out of scope cho MVP này)

- MFA (2FA)
- Social login (Google/Facebook...)
- Account lockout theo số lần sai password
- Device fingerprinting
- SSO (Single Sign-On)
- Permission matrix nâng cao (fine-grained permission ngoài Role + Ownership)
- Access-token revocation tức thời (denylist/token-version) — xem [10. Known Gaps](#10-known-gaps)

> Danh sách "không bao gồm" ở trên không phải bị cấm mãi mãi — chỉ ngoài phạm vi MVP này.

---

## 2. Decisions

| #   | Chủ đề                               | Quyết định                                                                                                                                                                               | Lý do                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Login khi chưa verify email          | Chặn hoàn toàn                                                                                                                                                                           | Tránh tài khoản chưa xác thực danh tính thao tác trên hệ thống (đặt hàng, thanh toán...)                                                                                                                                                                                           |
| 2   | Refresh token rotation               | Có, từ MVP                                                                                                                                                                               | Giảm rủi ro nếu refresh token bị đánh cắp — token cũ bị vô hiệu ngay sau khi dùng                                                                                                                                                                                                  |
| 3   | Reuse detection                      | Refresh token đã revoked mà bị dùng lại → revoke toàn bộ **refresh session** của user đó                                                                                                 | Dấu hiệu refresh token bị đánh cắp. **Lưu ý:** chỉ thu hồi được các refresh token — access token JWT đã phát hành vẫn sống tới khi hết TTL (15 phút), vì đây là stateless token, xem [10. Known Gaps](#10-known-gaps)                                                              |
| 4   | Account lockout (sai password N lần) | Chưa làm ở MVP                                                                                                                                                                           | Ưu tiên thấp hơn so với các rủi ro khác; rate limiting theo IP đã giảm phần nào rủi ro brute-force                                                                                                                                                                                 |
| 5   | CONTEXT.md                           | Viết lại theo domain ecommerce, bắt đầu từ Auth                                                                                                                                          | CONTEXT.md hiện mô tả domain "Todo List" cũ — sai hoàn toàn, gây nhầm lẫn cho dev/agent sau                                                                                                                                                                                        |
| 6   | Role model                           | DB-driven (`roles.name` là data, không phải enum cứng)                                                                                                                                   | Cho phép ADMIN tạo role mới (STAFF, WAREHOUSE...) qua data mà không cần sửa code/enum                                                                                                                                                                                              |
| 7   | Order "eligible" để cancel           | Chỉ `PENDING`                                                                                                                                                                            | `PAID` coi như đã thanh toán thành công, hủy cần flow refund riêng — ngoài scope auth                                                                                                                                                                                              |
| 8   | Token cũ khi resend/forgot-password  | Xoá (delete) token chưa dùng của user trước khi tạo token mới                                                                                                                            | Đơn giản, không cần sửa schema (schema hiện không có cột `revokedAt`/`invalidatedAt` cho 2 bảng token này)                                                                                                                                                                         |
| 9   | Password policy                      | Bắt buộc hoa + thường + số + ký tự đặc biệt, tối thiểu 8 ký tự                                                                                                                           | Cân bằng an toàn cho ecommerce có giao dịch tiền                                                                                                                                                                                                                                   |
| 10  | Email enumeration                    | `register` → 409 rõ ràng; `forgot-password` và `resend-verification` → message chung chung                                                                                               | Register cần UX rõ ràng (gợi ý login); các flow nhạy cảm hơn (reset password) cần giấu sự tồn tại của email                                                                                                                                                                        |
| 11  | Rate limiting                        | Áp dụng cho `login`, `forgot-password`, `resend-verification`, `register`, `verify-email`, `refresh` — threshold khác nhau tuỳ endpoint; implement ở giai đoạn gần cuối playbook         | Các endpoint public-facing đều có rủi ro spam/brute-force/enumeration ở mức độ khác nhau, nhưng không block các business flow chính trong lúc dev                                                                                                                                  |
| 12  | Token TTL                            | Access 15 phút / Refresh 7 ngày, đọc qua `ConfigService`                                                                                                                                 | Access ngắn để giảm thiệt hại nếu bị lộ; refresh 7 ngày phù hợp tần suất quay lại mua hàng                                                                                                                                                                                         |
| 13  | Ownership check                      | Guard/decorator dùng chung (`OwnershipGuard`), implementation MVP dùng callback `fetch` trực tiếp                                                                                        | Tái sử dụng được cho nhiều resource (Order, Cart...) thay vì lặp code kiểm tra thủ công; xem [10. Known Gaps](#10-known-gaps) về coupling với Prisma                                                                                                                               |
| 14  | Thuật ngữ "Session"                  | Một **phiên đăng nhập logic**, đại diện bởi một `RefreshToken` record. MVP không xác thực danh tính thiết bị vật lý                                                                      | Tránh khẳng định quá chắc "1 Session = 1 thiết bị" khi chưa có device fingerprinting (ngoài scope)                                                                                                                                                                                 |
| 15  | Thuật ngữ trạng thái User            | Tách 2 trục: **Account status** (`User.status`: ACTIVE/BLOCKED) và **Email verification** (`emailVerifiedAt`) — login cần cả hai                                                         | Doc gốc gộp mơ hồ 2 trục độc lập, dễ gây bug logic                                                                                                                                                                                                                                 |
| 16  | Admin bootstrap                      | Seed script tạo sẵn 1 tài khoản ADMIN đầu tiên (email/password từ env)                                                                                                                   | Không expose endpoint HTTP tạo ADMIN — giảm bề mặt tấn công                                                                                                                                                                                                                        |
| 17  | Refresh token delivery               | HttpOnly + Secure + SameSite cookie, `path` giới hạn theo prefix route auth thực tế (mặc định `/auth`, xem lưu ý STEP 10) — server set, JS không đọc được, không trả trong response body | Target chính là web browser; giảm rủi ro XSS đọc được refresh token so với để frontend lưu `localStorage`. Giới hạn `path` giúp cookie chỉ gửi kèm request tới route auth, không gửi tới toàn site. Access token vẫn trả trong response body (ngắn hạn, chấp nhận rủi ro thấp hơn) |
| 18  | Refresh token type                   | Opaque random token (không phải JWT) → hash SHA-256 → lưu `tokenHash`                                                                                                                    | Khớp đúng với schema hiện tại (`refresh_tokens.tokenHash`, rotation, reuse detection) — không cần `JWT_REFRESH_SECRET` vì không ký/verify bằng JWT                                                                                                                                 |

### Lỗi cần sửa kèm trong `../module-auth.md`

- Bảng API tổng kết ở mục 26 thiếu dòng `POST /auth/logout-all`.
- Xem thêm [10. Known Gaps](#10-known-gaps) để cập nhật đồng bộ 2 file.

---

## 3. Architecture Overview

### Thành phần chính

```text
Client
  ↓
AuthController
  ↓
AuthService  (orchestrate business flow — KHÔNG tự làm hết mọi việc)
  ├── PrismaService       → truy vấn/ghi DB
  ├── PasswordService      → hash / verify password
  ├── TokenService         → generate / hash verification/reset/refresh token
  ├── MailService          → gửi verification/reset email (module riêng: src/mail/)
  └── JwtService (@nestjs/jwt) → sinh/verify access token
```

> **Nguyên tắc:** `AuthService` không tự hash password, tự sinh token thô, hay tự gọi SMTP — nó **điều phối** các service chuyên trách bên dưới. Chi tiết phân trách nhiệm ở [7. Shared Services](#7-shared-services).

### Request pipeline cho endpoint cần đăng nhập

```text
Authenticated request
      ↓
JwtAuthGuard        (xác thực JWT còn hạn, gắn CurrentUser vào request)
      ↓
@CurrentUser()       (decorator lấy user từ request)
      ↓
RolesGuard           (kiểm tra role, nếu route có @Roles(...))
      ↓
OwnershipGuard        (kiểm tra resource.userId === currentUser.id, nếu route có @OwnedResource(...))
      ↓
Controller
      ↓
Service               (business rule sâu hơn ownership — xem quy tắc Guard vs Service ở mục 6)
```

### Thứ tự triển khai tổng quát (chi tiết ở mục 4)

```text
Domain decisions (đã chốt ở mục 2)
      ↓
Schema readiness (đã đủ — không cần migration mới cho MVP)
      ↓
Shared services (Password/Token/Mail)
      ↓
Register → Email verification → Login → JWT → Refresh rotation
      ↓
Guards (JwtAuth / Roles / Ownership)
      ↓
Logout / Logout-all
      ↓
Forgot / Reset password
      ↓
Rate limiting
      ↓
Security review (đối chiếu mục 6)
      ↓
Unit test → E2E test → Swagger
      ↓
Lint → Build → PR
```

---

## 4. Implementation Steps

Mỗi step theo khuôn: **Goal / Files / CLI / Implementation / Acceptance Criteria / Tests**. Step nào không cần 1 mục nào đó (vd step config thuần không cần Tests riêng) thì mục đó được rút gọn hoặc bỏ qua có ghi chú.

> **Quy ước shell:** các lệnh `npm`/`npx` chạy giống nhau trên mọi shell. Lệnh tạo file/folder rỗng (touch-style) khác nhau giữa PowerShell và Bash (Git Bash/WSL) nên được ghi **riêng từng block có nhãn** — chọn theo shell bạn đang dùng, không trộn cú pháp.

### STEP 0 — Cập nhật CONTEXT.md — 🔴 Chưa làm

**Goal:** CONTEXT.md phản ánh đúng domain ecommerce hiện tại, bắt đầu từ glossary Auth.

**Files:** `../../CONTEXT.md`

> 📘 **Khái niệm — vì sao cần `../../CONTEXT.md` riêng, không viết thẳng vào code?**
> `../../CONTEXT.md` là **glossary domain** — nơi định nghĩa thuật ngữ nghiệp vụ (User, Role, Session nghĩa là gì trong app này) tách khỏi chi tiết kỹ thuật (TTL bao lâu, hash bằng thuật toán gì). Dev mới (hoặc AI agent) đọc file này trước để hiểu "ngôn ngữ chung" của domain, rồi mới đọc playbook để biết cách implement. Nếu gộp 2 thứ vào 1 chỗ, glossary sẽ phình to và lẫn lộn giữa "khái niệm" và "cách làm".

**Implementation:**

1. Mở `../../CONTEXT.md` — nội dung hiện tại mô tả domain "Todo List" cũ, không còn đúng. Xoá toàn bộ, viết lại từ đầu.
2. Viết các mục thuật ngữ sau (chỉ định nghĩa, không viết TTL/thuật toán/tên biến):

   ```markdown
   # CONTEXT.md — Ecommerce Domain Glossary

   ## Auth & Authorization

   - **User** — tài khoản trong hệ thống. Có `email` (duy nhất), `passwordHash`
     (không bao giờ lưu password thô), một **Account status**, và trạng thái
     **Email verification**.
   - **Account status** — trạng thái tài khoản do ADMIN quản lý: `ACTIVE` (dùng
     bình thường) hoặc `BLOCKED` (bị khoá, không đăng nhập được).
   - **Email verification** — trục trạng thái **độc lập** với Account status,
     xác định user đã xác minh quyền sở hữu email hay chưa. Một User có thể
     `ACTIVE` nhưng chưa verify email — cả hai điều kiện đều phải đúng thì mới
     đăng nhập được.
   - **Role** — nhãn quyền hạn gán cho User (vd `ADMIN`, `CUSTOMER`). Role là
     **dữ liệu trong DB**, không phải hằng số cứng trong code — cho phép thêm
     role mới (vd `STAFF`) mà không cần sửa code.
   - **Session** — một phiên đăng nhập logic của User, đại diện bởi một bản ghi
     Refresh Token. Không tương đương "1 thiết bị vật lý" (hệ thống chưa nhận
     diện thiết bị).
   - **Email Verification Token** / **Password Reset Token** — token dùng một
     lần, gửi qua email, luôn lưu dưới dạng hash trong DB (không bao giờ lưu
     bản gốc).
   ```

3. Không thêm chi tiết implementation (TTL, thuật toán hash, tên cookie...) — những thứ đó thuộc về playbook này, không thuộc glossary.

**Acceptance Criteria:**

- [ ] CONTEXT.md không còn nhắc tới domain "Todo List".
- [ ] Glossary chỉ chứa định nghĩa thuật ngữ, không chứa implementation detail.

---

### STEP 1 — Seed roles + admin bootstrap — 🔴 Chưa làm

**Goal:** Có sẵn role `ADMIN`/`CUSTOMER` và 1 tài khoản ADMIN đầu tiên khi hệ thống khởi động lần đầu.

**Files:** `../../prisma/seed.ts`, `../../package.json` (thêm script `db:seed`)

⚠️ **`../../prisma/seed.ts` đã tồn tại trong repo — nhưng KHÔNG phải seed logic Auth.** File hiện tại là seed script cũ của app Todo trước đây (`prisma.todo.createMany(...)` với dữ liệu mẫu tiếng Việt), không seed role/admin gì cả. **Đừng bỏ qua step này vì "file đã có"** — mở file hiện có và **thay thế toàn bộ nội dung**, không chạy CLI tạo file mới (sẽ báo lỗi file đã tồn tại).

> 📘 **Khái niệm — vì sao seed phải "idempotent" (chạy lại nhiều lần không tạo trùng)?**
> Seed script thường được chạy lại nhiều lần: mỗi lần setup máy dev mới, mỗi lần CI build DB test, mỗi lần deploy lại. Nếu seed dùng `create()` thẳng, chạy lần 2 sẽ báo lỗi trùng unique key (`email`, `name`) hoặc tạo ra 2 role `ADMIN` khác nhau. Prisma có sẵn `upsert()`: "nếu đã tồn tại (theo điều kiện `where`) thì update, chưa có thì tạo mới" — dùng đúng 1 lần gọi để vừa tạo vừa không trùng.

**Implementation:**

1. Đảm bảo `../../package.json` → `"scripts"` có dòng (chưa có, thêm mới):

   ```json
   "db:seed": "tsx prisma/seed.ts"
   ```

2. Viết lại toàn bộ `../../prisma/seed.ts`:

   ```ts
   import { PrismaClient } from '@prisma/client';
   import * as argon2 from 'argon2';

   const prisma = new PrismaClient();

   async function main() {
     // 1. Seed role — upsert theo `name` (unique) để chạy lại không tạo trùng
     const adminRole = await prisma.role.upsert({
       where: { name: 'ADMIN' },
       update: {},
       create: { name: 'ADMIN' },
     });
     await prisma.role.upsert({
       where: { name: 'CUSTOMER' },
       update: {},
       create: { name: 'CUSTOMER' },
     });

     // 2. Đọc thông tin admin bootstrap từ env
     //    ⚠️ Ngoại lệ có chủ đích: seed.ts chạy độc lập ngoài Nest DI container
     //    (không có ConfigService để inject) nên được phép đọc process.env
     //    trực tiếp — đây là NGOẠI LỆ DUY NHẤT, không áp dụng cho code trong src/.
     const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
     const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
     if (!email || !password) {
       throw new Error('Thiếu ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD trong .env');
     }

     // 3. Idempotent: nếu admin đã tồn tại (theo email) thì bỏ qua, không tạo lại
     const existingAdmin = await prisma.user.findUnique({ where: { email } });
     if (existingAdmin) {
       console.log(`Admin ${email} đã tồn tại, bỏ qua.`);
       return;
     }

     const passwordHash = await argon2.hash(password);
     await prisma.user.create({
       data: {
         email,
         passwordHash,
         status: 'ACTIVE',
         emailVerifiedAt: new Date(), // admin bootstrap không cần verify email
         userRoles: { create: [{ roleId: adminRole.id }] },
       },
     });
     console.log(`Đã tạo admin ${email}.`);
   }

   main()
     .catch((e) => {
       console.error(e);
       process.exit(1);
     })
     .finally(async () => {
       await prisma.$disconnect();
     });
   ```

   > ⚠️ Tên field/relation (`userRoles`, `roleId`, `status`, `emailVerifiedAt`...) phải khớp đúng với `../../prisma/schema.prisma` hiện tại — mở file schema đối chiếu trước khi paste code trên, sửa lại tên field nếu khác.

3. Không tạo endpoint HTTP nào để tạo ADMIN — chỉ qua seed script (giảm bề mặt tấn công, quyết định #16).

**Acceptance Criteria:**

- [ ] Chạy `npm run db:seed` nhiều lần không tạo trùng role/admin.
- [ ] Sau khi seed, DB có ít nhất role `ADMIN` và `CUSTOMER` và 1 user ADMIN.

**CLI (chạy sau khi code xong):**

```bash
npm run db:seed
```

---

### STEP 2 — Cài package — 🔴 Chưa làm

**Goal:** Có đủ dependency cho hashing + JWT + Passport.

> 📘 **Khái niệm — từng package dùng để làm gì:**
>
> | Package               | Vai trò                                                                                                                           |
> | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
> | `argon2`              | Hash password — thuật toán hash chuyên dụng cho password (chậm có chủ đích, chống brute-force), khác hẳn hash thường như SHA-256. |
> | `@nestjs/jwt`         | Sinh và verify JWT (access token) — wrapper chính thức của Nest quanh thư viện `jsonwebtoken`.                                    |
> | `@nestjs/passport`    | Tích hợp Passport.js (thư viện auth phổ biến) vào NestJS theo kiểu Guard/Strategy.                                                |
> | `passport-jwt`        | Passport "strategy" cụ thể để verify JWT lấy từ header `Authorization: Bearer <token>`.                                           |
> | `@types/passport-jwt` | Type definition cho `passport-jwt` (package gốc viết bằng JS, không có type sẵn).                                                 |

**CLI:**

```bash
npm install argon2 @nestjs/jwt @nestjs/passport passport-jwt
npm install -D @types/passport-jwt
```

> Chưa cài `@nestjs/throttler` ở bước này — xem STEP 20.

**Acceptance Criteria:**

- [ ] `../../package.json` có đủ 4 dependency + 1 devDependency ở trên.

---

### STEP 3 — Env vars — 🔴 Chưa làm

**Goal:** Toàn bộ config nhạy cảm đọc qua `ConfigService`, có file mẫu cho dev khác.

**Files:** `../../.env.example`, `../../.env` (local, không commit)

> 📘 **Khái niệm — `ConfigService` là gì, vì sao không dùng `process.env.XXX` thẳng trong code?**
> `ConfigService` (từ `@nestjs/config`) là 1 service được NestJS "tiêm" (dependency injection — DI, xem giải thích đầy đủ ở STEP 4) vào bất kỳ class nào cần đọc config, thay vì gọi `process.env.XXX` rải rác khắp nơi. Lợi ích: (1) test dễ hơn — mock `ConfigService` thay vì mock biến môi trường thật của process; (2) một chỗ duy nhất kiểm soát giá trị mặc định/validate; (3) tránh gõ sai tên biến env ở nhiều chỗ khác nhau mà không ai biết. Ngoại lệ duy nhất là `../../prisma/seed.ts` (xem STEP 1) vì nó chạy ngoài Nest DI container.

**CLI:**

```powershell
# PowerShell
@'
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_TTL=7d
REFRESH_TOKEN_COOKIE_NAME=refresh_token
ADMIN_BOOTSTRAP_EMAIL=
ADMIN_BOOTSTRAP_PASSWORD=
'@ | Set-Content .env.example
```

```bash
# Bash (Git Bash/WSL)
cat > .env.example << 'EOF'
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_TTL=7d
REFRESH_TOKEN_COOKIE_NAME=refresh_token
ADMIN_BOOTSTRAP_EMAIL=
ADMIN_BOOTSTRAP_PASSWORD=
EOF
```

> ⚠️ Không có `JWT_REFRESH_SECRET` — refresh token trong thiết kế này là **opaque random token** (không phải JWT), chỉ lưu dạng hash trong DB (`refresh_tokens.tokenHash`). Không cần secret để ký/verify nó, chỉ cần so khớp hash khi tra DB. Xem STEP 12.

```bash
# Sinh secret ngẫu nhiên để dán vào .env local (chạy được trên cả 2 shell qua Node)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Sau khi tạo `../../.env.example`, copy thành `../../.env` và điền giá trị thật (secret vừa sinh, `DATABASE_URL` thật, email/password admin bootstrap):

```powershell
Copy-Item .env.example .env   # PowerShell
```

```bash
cp .env.example .env   # Bash (Git Bash/WSL)
```

**Acceptance Criteria:**

- [ ] `../../.env.example` tồn tại, không chứa giá trị thật.
- [ ] `../../.env` local có giá trị thật, không được commit (`../../.gitignore` đã có `.env` — kiểm tra lại).
- [ ] Không có `process.env.XXX` nào được gọi trực tiếp trong code auth (trừ `../../prisma/seed.ts`).

---

### STEP 4 — Scaffold module — 🔴 Chưa làm

**Goal:** Có khung thư mục đúng kiến trúc ở mục 3 & 7, sẵn sàng để điền logic.

> 📘 **Khái niệm nền tảng NestJS (đọc trước khi chạy CLI bên dưới):**
>
> - **Module** (`*.module.ts`) — 1 "hộp" gom nhóm các Controller + Service liên quan tới nhau (vd toàn bộ auth nằm trong `AuthModule`). App NestJS là 1 cây Module lồng nhau, gốc là `AppModule`.
> - **Controller** (`*.controller.ts`) — nhận HTTP request (route `/auth/register`...), gọi Service xử lý, trả response. Controller **không chứa business logic**, chỉ điều hướng.
> - **Service** (`*.service.ts`) — nơi chứa business logic thật (hash password, tạo user, gửi email...). Đánh dấu bằng decorator `@Injectable()`.
> - **Dependency Injection (DI)** — thay vì Controller tự `new AuthService()`, NestJS tự tạo instance `AuthService` và "tiêm" (inject) vào constructor của Controller. Lợi ích: dễ test (thay instance thật bằng mock trong unit test), dễ tái sử dụng 1 instance cho toàn app (singleton).
> - **Guard** (`*.guard.ts`) — đoạn code chạy **trước** khi request tới Controller, quyết định request có được đi tiếp hay không (vd `JwtAuthGuard` chặn request không có token hợp lệ).
> - **Decorator** (`@Something()`) — cú pháp gắn "metadata" lên class/method/param (vd `@Roles('ADMIN')` gắn thông tin "route này cần role ADMIN" lên method, để `RolesGuard` đọc lại metadata đó lúc runtime qua `Reflector`).
> - **DTO** (Data Transfer Object, `*.dto.ts`) — class định nghĩa hình dạng dữ liệu request/response (vd `RegisterDto` định nghĩa `email`, `password` client phải gửi lên), gắn kèm decorator validate (`class-validator`) để Nest tự động kiểm tra input trước khi vào Controller.

**Files:**

```
src/auth/
├── decorators/ (current-user.decorator.ts, roles.decorator.ts, owned-resource.decorator.ts)
├── dto/
├── guards/ (jwt-auth.guard.ts, roles.guard.ts, ownership.guard.ts)
├── strategies/ (jwt.strategy.ts)
├── services/
│   ├── auth.service.ts       (orchestrator)
│   ├── password.service.ts
│   └── token.service.ts
├── auth.controller.ts
└── auth.module.ts

src/mail/
├── mail.service.ts
└── mail.module.ts
```

**CLI:**

```bash
npx nest g module auth
npx nest g controller auth --no-spec

# Shared services trong auth module
npx nest g service auth/services/auth --flat --no-spec
npx nest g service auth/services/password --flat --no-spec
npx nest g service auth/services/token --flat --no-spec

# Mail module (đứng ngoài auth module — auth không biết provider cụ thể)
npx nest g module mail
npx nest g service mail --no-spec

# Guards
npx nest g guard auth/guards/jwt-auth --flat --no-spec
npx nest g guard auth/guards/roles --flat --no-spec
npx nest g guard auth/guards/ownership --flat --no-spec

# Decorators
npx nest g decorator auth/decorators/current-user --flat --no-spec
npx nest g decorator auth/decorators/roles --flat --no-spec
npx nest g decorator auth/decorators/owned-resource --flat --no-spec
```

> `nest g <schematic> <path>` tự tạo file **và** tự đăng ký (import + thêm vào mảng `providers`/`controllers`) trong module gần nhất — đây là lý do dùng CLI thay vì tự tạo file tay: đỡ quên đăng ký thủ công.

**Strategy + DTO folder (không có schematic riêng — tạo thủ công):**

```powershell
# PowerShell
New-Item src/auth/strategies -ItemType Directory -Force
New-Item src/auth/strategies/jwt.strategy.ts -ItemType File
New-Item src/auth/dto -ItemType Directory -Force
```

```bash
# Bash (Git Bash/WSL)
mkdir -p src/auth/strategies && touch src/auth/strategies/jwt.strategy.ts
mkdir -p src/auth/dto
```

Cuối cùng, mở `../../src/app.module.ts` và thêm `AuthModule`, `MailModule` vào mảng `imports` (CLI `nest g module` thường đã tự làm việc này — kiểm tra lại, không giả định):

```ts
@Module({
  imports: [
    // ...các module có sẵn (PrismaModule, ConfigModule...)
    AuthModule,
    MailModule,
  ],
})
export class AppModule {}
```

**Acceptance Criteria:**

- [ ] `../../src/app.module.ts` đã import `AuthModule` và `MailModule`.
- [ ] `npm run build` không lỗi (dù logic bên trong chưa hoàn thiện, file rỗng vẫn build được).

---

### STEP 5 — Register (`POST /auth/register`) — 🔴 Chưa làm

**Goal:** Tạo user CUSTOMER mới và gửi email verification, không lưu raw password/token.

> STEP này gộp nhiều việc (DTO, hash password, sinh token, transaction, gửi mail, controller) nên được **tách thành 6 step con** — làm tuần tự 5.1 → 5.6, mỗi step con build/compile được trước khi sang step tiếp theo.

---

#### STEP 5.1 — RegisterDto — 🔴 Chưa làm

**Goal:** Định nghĩa + validate dữ liệu client gửi lên khi đăng ký.

**Files:** `../../src/auth/dto/register.dto.ts`

**CLI:**

```powershell
New-Item src/auth/dto/register.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/register.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

> 📘 **Khái niệm — `class-validator` / `class-transformer`:** NestJS dùng `ValidationPipe` (thường bật global trong `main.ts`) để tự động validate request body dựa trên decorator từ package `class-validator` gắn lên DTO. Nếu input sai, Nest tự trả `400 Bad Request` **trước khi** code trong Controller/Service chạy — không cần tự viết `if` kiểm tra tay.

```ts
// src/auth/dto/register.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Abc@1234' })
  @IsString()
  @MinLength(8)
  // Áp dụng luôn password policy (quyết định #9) — chi tiết đầy đủ về pattern
  // và test case ở STEP 6, ở đây dùng luôn để RegisterDto hoạt động đúng ngay.
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt',
  })
  password: string;
}
```

**Acceptance Criteria:**

- [ ] File compile được (`npm run build` không lỗi), chưa cần route nào gọi tới.
- [ ] Import `RegisterDto` ở một file test tạm thời, tạo instance với `password: 'abc'` → thấy lỗi validate khi chạy qua `class-validator` (có thể để dành verify khi làm xong STEP 5.6, không bắt buộc viết test riêng ở đây).

---

#### STEP 5.2 — PasswordService (hash) — 🔴 Chưa làm

**Goal:** Hash password bằng argon2, không tự viết thuật toán hash tay.

**Files:** `../../src/auth/services/password.service.ts` (đã scaffold rỗng ở STEP 4)

**Implementation:**

> 📘 **Khái niệm — vì sao dùng `argon2` thay vì `bcrypt` hay tự viết SHA-256?** Password không được hash bằng thuật toán hash "nhanh" thông thường (MD5, SHA-256) vì máy tính hiện đại thử được hàng tỷ hash/giây → brute-force dễ dàng. `argon2` (và `bcrypt`) là thuật toán **cố tình chậm và tốn RAM**, khiến brute-force tốn kém về thời gian/tiền bạc. `argon2` là thuật toán thắng cuộc thi Password Hashing Competition, được khuyến nghị hiện nay.

```ts
// src/auth/services/password.service.ts
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  async hash(rawPassword: string): Promise<string> {
    return argon2.hash(rawPassword);
  }

  async verify(passwordHash: string, rawPassword: string): Promise<boolean> {
    return argon2.verify(passwordHash, rawPassword);
  }
}
```

> `argon2.hash()` tự sinh salt ngẫu nhiên và nhúng vào chuỗi hash trả về — không cần tự quản lý salt riêng.

**Acceptance Criteria:**

- [ ] Gọi `hash('Abc@1234')` 2 lần → 2 chuỗi hash **khác nhau** (do salt ngẫu nhiên), nhưng cả 2 đều `verify()` đúng với `'Abc@1234'`.

---

#### STEP 5.3 — TokenService (tối thiểu cho email verification) — 🔴 Chưa làm

**Goal:** Sinh token ngẫu nhiên + hash để lưu DB, đủ dùng cho Register. Bản đầy đủ (dùng chung cho reset-password/refresh) làm ở STEP 7 — ở đây chỉ implement phần tối thiểu để STEP 5 chạy được.

**Files:** `../../src/auth/services/token.service.ts` (đã scaffold rỗng ở STEP 4)

**Implementation:**

> 📘 **Khái niệm — vì sao token gửi qua email khác với token lưu trong DB?**
> Nếu lưu thẳng token gốc (raw token) vào DB, ai đọc được DB (backup leak, SQL injection...) sẽ dùng được token đó luôn — giống hệt như lưu raw password. Cách làm đúng: sinh token ngẫu nhiên (`rawToken`), gửi `rawToken` qua email cho user, nhưng **chỉ lưu `hash(rawToken)`** vào DB. Khi user click link chứa `rawToken`, server hash lại và so khớp với `tokenHash` trong DB — không cần lưu bản gốc mà vẫn xác minh được.

```ts
// src/auth/services/token.service.ts
import { randomBytes, createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // chỉnh lại path đúng với vị trí PrismaService trong repo

@Injectable()
export class TokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sinh token ngẫu nhiên (raw) + hash SHA-256 của nó. */
  private generate(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    return { rawToken, tokenHash };
  }

  /**
   * Tạo Email Verification Token mới cho user — xoá token cũ chưa dùng trước
   * (quyết định #8), trả về rawToken để gửi qua email (không lưu raw vào DB).
   */
  async createEmailVerificationToken(userId: string): Promise<string> {
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId, verifiedAt: null },
    });

    const { rawToken, tokenHash } = this.generate();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h, đủ dùng cho MVP

    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return rawToken;
  }
}
```

> ⚠️ Tên model/field Prisma (`emailVerificationToken`, `userId`, `tokenHash`, `expiresAt`, `verifiedAt`) phải khớp `../../prisma/schema.prisma` — đối chiếu lại trước khi paste. Method `createPasswordResetToken`, `hashRawToken` (dùng ở verify/refresh) sẽ được thêm đầy đủ ở STEP 7.

**Acceptance Criteria:**

- [ ] File compile được, `createEmailVerificationToken()` gọi được từ 1 test tạm hoặc từ STEP 5.5 và tạo đúng 1 record trong bảng `email_verification_tokens`.

---

#### STEP 5.4 — MailService (gửi email verification) — 🔴 Chưa làm

**Goal:** Gửi email chứa link verification, đứng ngoài `auth` module.

**Files:** `../../src/mail/mail.service.ts` (đã scaffold rỗng ở STEP 4)

**Implementation:**

> 📘 **Khái niệm — vì sao `MailService` là module riêng, không nằm trong `auth`?** `AuthService` không cần biết chi tiết gửi mail qua SMTP hay SES/SendGrid — nó chỉ cần gọi `mailService.sendVerificationEmail(email, token)`. Tách riêng giúp sau này đổi provider gửi mail mà không đụng vào code auth. Xem thêm [7. Shared Services](#7-shared-services) về nguyên tắc không tạo interface/DI token thừa cho MVP.

```ts
// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendVerificationEmail(to: string, rawToken: string): Promise<void> {
    // MVP: log ra console thay vì gọi SMTP/SES thật — đủ để dev/test flow.
    // Khi có provider email thật, thay thân hàm này bằng lời gọi SDK tương ứng,
    // KHÔNG cần đổi chữ ký hàm hay chỗ gọi từ AuthService.
    this.logger.log(`[DEV] Gửi verification email tới ${to}: token=${rawToken}`);
  }

  async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
    this.logger.log(`[DEV] Gửi reset-password email tới ${to}: token=${rawToken}`);
  }
}
```

**Acceptance Criteria:**

- [ ] File compile được. Gọi `sendVerificationEmail('a@b.com', 'xyz')` in ra log đúng nội dung, không throw lỗi.

---

#### STEP 5.5 — AuthService.register() — 🔴 Chưa làm

**Goal:** Orchestrate toàn bộ flow register: validate email chưa tồn tại → hash password → transaction tạo user+role+token → gửi mail sau khi commit.

**Files:** `../../src/auth/services/auth.service.ts` (đã scaffold rỗng ở STEP 4)

**Implementation:**

> 📘 **Khái niệm — DB transaction là gì, vì sao cần?** Một transaction gom nhiều thao tác ghi DB (tạo user, gán role, tạo token) thành **1 khối tất-cả-hoặc-không-gì-cả**: nếu bước giữa chừng lỗi (vd gán role fail), toàn bộ được rollback — không để lại user "mồ côi" không có role. Prisma cung cấp `prisma.$transaction(async (tx) => {...})`, bên trong dùng `tx.<model>` thay vì `prisma.<model>` để mọi query nằm trong cùng 1 transaction.
>
> 📘 **Khái niệm — vì sao gửi email PHẢI nằm ngoài transaction?** Gọi email (network call ra ngoài) có thể chậm hoặc treo. Nếu đặt trong transaction, DB phải giữ lock/connection chờ suốt thời gian đó — tốn tài nguyên và tăng nguy cơ deadlock. Quy tắc: transaction chỉ chứa thao tác DB, side-effect ngoài (email, gọi API khác...) luôn thực hiện **sau khi transaction đã commit**. Xem thêm [7. Shared Services § Rule: Transaction không bọc external call](#7-shared-services).

```ts
// src/auth/services/auth.service.ts
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // chỉnh lại path đúng repo
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { MailService } from '../../mail/mail.service';
import { RegisterDto } from '../dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    // 1. Check email đã tồn tại → 409 (quyết định #10: register cần rõ ràng,
    //    không cần giấu enumeration như forgot-password/resend-verification).
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // 2. Hash password TRƯỚC transaction — hash không phụ thuộc DB, không cần
    //    nằm trong transaction (và argon2 khá tốn CPU, không nên giữ transaction
    //    mở lâu hơn cần thiết).
    const passwordHash = await this.passwordService.hash(dto.password);

    // 3. Transaction: tạo user + gán role CUSTOMER + tạo verification token.
    //    Dùng `tx` (không phải `this.prisma`) bên trong để cùng 1 transaction.
    const { user, rawToken } = await this.prisma.$transaction(async (tx) => {
      const customerRole = await tx.role.findUniqueOrThrow({
        where: { name: 'CUSTOMER' },
      });

      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          status: 'ACTIVE',
          userRoles: { create: [{ roleId: customerRole.id }] },
        },
      });

      // TokenService cũng cần chạy trong transaction này để rollback đồng bộ
      // nếu có lỗi — nhưng TokenService ở STEP 5.3 tự inject PrismaService
      // riêng (không nhận `tx`). Cách đơn giản cho MVP: gọi thẳng
      // `tx.emailVerificationToken.create(...)` ở đây thay vì gọi qua
      // TokenService khi cần chung transaction — xem ghi chú bên dưới.
      const rawTok = await this.createVerificationTokenInTx(tx, createdUser.id);

      return { user: createdUser, rawToken: rawTok };
    });

    // 4. Gửi mail SAU khi transaction đã commit — không rollback nếu fail.
    try {
      await this.mailService.sendVerificationEmail(user.email, rawToken);
    } catch (err) {
      this.logger.error(`Gửi verification email thất bại cho ${user.email}`, err as Error);
      // Không throw lại — user vẫn được tạo, có thể resend-verification (STEP 9).
    }

    // 5. Response qua DTO allow-list — không trả passwordHash/token.
    return { id: user.id, email: user.email };
  }

  /**
   * Helper tạo verification token TRONG transaction hiện tại (`tx`), tách khỏi
   * TokenService.createEmailVerificationToken() (STEP 5.3) vì hàm đó tự mở
   * PrismaService riêng, không tham gia được transaction của Prisma Client
   * gốc. Đây là cách đơn giản cho MVP; nếu muốn tái sử dụng logic generate+hash
   * token của TokenService bên trong transaction, refactor TokenService để
   * nhận `tx` qua tham số thay vì tự inject `this.prisma` — cân nhắc khi làm
   * STEP 7 (không bắt buộc phải sửa ngay ở step này).
   */
  private async createVerificationTokenInTx(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
  ): Promise<string> {
    const { randomBytes, createHash } = await import('crypto');
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await tx.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return rawToken;
  }
}
```

> ⚠️ Đoạn `createVerificationTokenInTx` là do STEP 5.3 (`TokenService`) tự inject `PrismaService` riêng nên không tham gia chung transaction được với `AuthService.register()`. Đây là **giới hạn đã biết của bản MVP tối thiểu ở STEP 5.3** — chấp nhận trùng lặp code nhỏ để giữ transaction đúng, dọn lại (refactor `TokenService` nhận `tx`) khi làm STEP 7 nếu muốn.

**Acceptance Criteria:**

- [ ] Gọi `authService.register({ email, password })` với email mới → tạo đúng 1 User có role CUSTOMER + đúng 1 EmailVerificationToken, `passwordHash` không phải plain text.
- [ ] Gọi lại với cùng email → ném `ConflictException` (409), không tạo thêm user.

---

#### STEP 5.6 — AuthController (`POST /auth/register`) — 🔴 Chưa làm

**Goal:** Expose HTTP endpoint, trả đúng `RegisterResponseDto`.

**Files:** `../../src/auth/auth.controller.ts`, `src/auth/dto/register-response.dto.ts` (mới)

**CLI:**

```powershell
New-Item src/auth/dto/register-response.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/register-response.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

```ts
// src/auth/dto/register-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;
  // KHÔNG có accessToken/refreshToken — register không tự động login (quyết định #1)
}
```

```ts
// src/auth/auth.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './services/auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }
}
```

> `@HttpCode(HttpStatus.CREATED)` set status `201` — mặc định `@Post()` của Nest trả `200`\` nếu không khai báo rõ.

**Acceptance Criteria (toàn bộ flow STEP 5 — verify sau khi xong 5.1→5.6):**

- [ ] 201 khi thành công.
- [ ] 409 khi email đã tồn tại.
- [ ] 400 khi input không hợp lệ (password không đủ policy...).
- [ ] Password không bao giờ lưu raw — chỉ `passwordHash`.
- [ ] Verification token không bao giờ lưu raw — chỉ `tokenHash`.
- [ ] Response không chứa `passwordHash`.
- [ ] Email verification được gửi đúng 1 lần sau khi transaction commit.

**Tests:**

- register success.
- duplicate email → 409.
- weak password → 400.
- mail service throw lỗi → user vẫn được tạo (không rollback), lỗi được log.

---

### STEP 6 — Password policy — 🔴 Chưa làm

**Goal:** Password đáp ứng quyết định #9 (hoa + thường + số + ký tự đặc biệt, ≥ 8 ký tự).

**Files:** `../../src/auth/dto/register.dto.ts`, `src/auth/dto/reset-password.dto.ts` (STEP B)

**Implementation:**

```ts
@MinLength(8)
@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
password: string;
```

Viết trực tiếp vào 2 DTO trên — không cần file/CLI riêng cho step này.

**Acceptance Criteria:**

- [ ] Password `abc12345` (thiếu hoa + ký tự đặc biệt) → 400.
- [ ] Password `Abc@1234` → hợp lệ.

---

### STEP 7 — Email verification token (`TokenService`) — 🔴 Chưa làm

**Goal:** `TokenService` sinh + hash token dùng chung cho email verification / password reset / refresh.

**Files:** `../../src/auth/services/token.service.ts`

**Implementation:**

- Random token (đủ entropy, vd 32 byte) → SHA-256 → lưu `tokenHash` + `expiresAt`. Raw token chỉ gửi qua email, không bao giờ lưu DB.
- Trước khi tạo token mới cho cùng user (dùng ở resend/forgot-password — STEP 9, STEP A): **xoá token cũ của user chưa dùng và chưa hết hạn** (quyết định #8), rồi mới insert token mới.
- Method riêng cho từng loại token nhưng dùng chung hàm generate/hash.

**Acceptance Criteria:**

- [ ] `TokenService` không có method nào trả raw token ra ngoài trừ lúc tạo mới (để gửi email).
- [ ] Gọi tạo token 2 lần liên tiếp cho cùng user → chỉ còn 1 token hợp lệ trong DB.

---

### STEP 8 — Verify Email (`POST /auth/verify-email`) — 🔴 Chưa làm

**Goal:** Xác thực email bằng token, cập nhật `emailVerifiedAt`.

**Files:** `../../src/auth/dto/verify-email.dto.ts`

**CLI:**

```powershell
New-Item src/auth/dto/verify-email.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/verify-email.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

- Hash token nhận được → tìm `EmailVerificationToken` → kiểm tra hết hạn / đã verify.
- Transaction: cập nhật `User.emailVerifiedAt` + `token.verifiedAt`.

**Acceptance Criteria:**

- [ ] Token hợp lệ → verify thành công, gọi lại lần 2 → lỗi (đã verified).
- [ ] Token không tồn tại → 400/404.
- [ ] Token hết hạn → 400.

**Tests:**

- verify success.
- token không tồn tại.
- token hết hạn.
- verify token đã dùng rồi (replay protection — gọi lại lần 2 với token đã verified phải bị reject, không phải hành vi idempotent).

---

### STEP 9 — Resend Verification (`POST /auth/resend-verification`) — 🔴 Chưa làm

**Goal:** Cho phép gửi lại email verification mà không lộ thông tin email có tồn tại hay không.

**Files:** `../../src/auth/dto/resend-verification.dto.ts`

**CLI:**

```powershell
New-Item src/auth/dto/resend-verification.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/resend-verification.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

- Tìm user theo email. Không tồn tại hoặc đã verified → **vẫn trả cùng một message chung chung** (quyết định #10).
- Hợp lệ: xoá token cũ (STEP 7) → tạo token mới → gửi email (sau khi DB commit, giống STEP 5.5).

**Acceptance Criteria:**

- [ ] Response luôn cùng 1 dạng message/status bất kể email tồn tại hay không.
- [ ] Email tồn tại & chưa verify → token mới được tạo, email được gửi.
- [ ] Email đã verified → không tạo token mới, response vẫn giống case hợp lệ.

**Tests:**

- resend với email tồn tại & chưa verify.
- resend với email đã verified.
- resend với email không tồn tại → response không phân biệt được với case hợp lệ.

---

### STEP 10 — Login (`POST /auth/login`) — 🔴 Chưa làm

**Goal:** Xác thực user, trả Access Token trong body + set Refresh Token qua cookie (quyết định #17).

**Files:** `../../src/auth/dto/login.dto.ts`, `src/auth/dto/login-response.dto.ts`

**CLI:**

```powershell
New-Item src/auth/dto/login.dto.ts -ItemType File   # PowerShell
New-Item src/auth/dto/login-response.dto.ts -ItemType File
```

```bash
touch src/auth/dto/login.dto.ts src/auth/dto/login-response.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

- Tìm user theo email → not found → lỗi generic 401 (không phân biệt sai email/sai password).
- Kiểm tra **cả hai trục** (quyết định #15): `Account status === ACTIVE` **và** `emailVerifiedAt !== null`. Thiếu 1 trong 2 → chặn (quyết định #1) — nhưng không trả lỗi kiểu "email không tồn tại".
- `PasswordService.verify()` → load roles → generate Access Token (STEP 11) + Refresh Token (STEP 12).
- **Response body** (`LoginResponseDto`, xem [6. Security Rules](#6-security-rules)): `{ accessToken, user: AuthUserResponseDto }` — **không có `refreshToken` trong body**.
- **Refresh token** set qua `response.cookie(REFRESH_TOKEN_COOKIE_NAME, rawRefreshToken, { httpOnly: true, secure: true, sameSite: 'strict', path: '/auth', maxAge: <TTL ms> })` — đọc tên cookie + TTL từ `ConfigService`. `path: '/auth'` giới hạn cookie chỉ được browser gửi kèm request tới `/auth/*` (bao gồm `/auth/refresh`, `/auth/logout`) — **không** gửi kèm mọi request khác trong site (vd `/orders`, `/products`), giảm bề mặt tấn công so với path mặc định (`/`). ⚠️ **`path` này phải khớp đúng prefix route auth thực tế của app** — ví dụ nếu app có global prefix (`app.setGlobalPrefix('api')` → route thật là `/api/auth/*`), `path` phải là `/api/auth`, không phải `/auth` cứng nhắc. Kiểm tra `main.ts` trước khi code STEP này.

**Acceptance Criteria:**

- [ ] Login đúng → body trả `{ accessToken, user }`, **không có `refreshToken` trong body**.
- [ ] Cookie refresh token được set với đủ flag `HttpOnly` + `Secure` + `SameSite`.
- [ ] Sai password / email không tồn tại → cùng 1 loại lỗi 401.
- [ ] Account `BLOCKED` → bị chặn, lỗi khác biệt rõ với case sai password (nhưng không lộ email tồn tại theo kiểu enumeration).
- [ ] Email chưa verify → bị chặn.

**Tests:**

- login success — assert response body không chứa `refreshToken`, assert `Set-Cookie` header có đủ flag.
- login sai password.
- login email không tồn tại (response phải giống hệt case sai password).
- login user BLOCKED.
- login user chưa verify email.

---

### STEP 11 — Access Token — 🔴 Chưa làm

**Goal:** Sinh JWT access token ngắn hạn.

**Implementation:**

- TTL 15 phút (env `JWT_ACCESS_TTL`).
- Payload: `sub` (userId), `email`, `roles` (mảng string từ `userRoles` → `role.name` — KHÔNG hardcode enum vì role DB-driven, quyết định #6).
- **Không** nhét `passwordHash`, refresh token, hay dữ liệu cá nhân không cần thiết vào payload.

**Acceptance Criteria:**

- [ ] Decode access token thấy đúng `sub`, `email`, `roles`.
- [ ] Token hết hạn sau 15 phút (test bằng cách mock `Date.now()` hoặc TTL ngắn trong test env).

---

### STEP 12 — Refresh Token + rotation + reuse detection — 🔴 Chưa làm

**Goal:** Cấp access token mới từ refresh token hợp lệ (đọc từ cookie), xoay vòng refresh token, phát hiện refresh token bị tái sử dụng sau khi đã revoke.

**Implementation:**

- Refresh token là **opaque random token, KHÔNG phải JWT** (quyết định #18) — random bytes → SHA-256 hash → `TokenService` lưu `refresh_tokens.tokenHash` + `expiresAt`. TTL 7 ngày (env `REFRESH_TOKEN_TTL`, không có secret vì không ký JWT).
- `/auth/refresh` đọc raw refresh token từ **cookie** (`REFRESH_TOKEN_COOKIE_NAME`, quyết định #17) — không nhận refresh token từ request body/param. Không cần DTO request cho endpoint này.
- **Rotation**: mỗi lần `/auth/refresh` thành công → revoke token cũ (`revokedAt = now()`) → tạo token mới → set cookie mới (cùng `path` khớp prefix route auth như STEP 10) → trả access token mới trong body.
- **Reuse detection** (quyết định #3): nếu token gửi lên đã có `revokedAt != null` → coi là dấu hiệu bị đánh cắp → revoke **toàn bộ `refresh_tokens` còn hiệu lực** của user đó → trả 401 + xoá cookie refresh token hiện tại.
- ⚠️ **Giới hạn quan trọng:** reuse detection chỉ revoke được **refresh token** (dùng ở `/auth/refresh`). **Access token JWT đã phát hành trước đó vẫn hợp lệ tới khi hết TTL (15 phút)** vì đây là stateless token — hệ thống hiện KHÔNG có access-token denylist/token-version. Đây là rủi ro đã biết, chấp nhận cho MVP vì TTL ngắn giới hạn thiệt hại. Xem [10. Known Gaps](#10-known-gaps).
- ⚠️ **CSRF note**: vì refresh token nằm trong cookie (browser tự động gửi kèm mọi request cùng origin), `/auth/refresh` và `/auth/logout` là state-changing endpoint đọc cookie — cần `SameSite=Strict` (hoặc `Lax` nếu cần hỗ trợ redirect flow) để giảm CSRF risk. Không tự implement CSRF token riêng cho MVP — ghi nhận ở [10. Known Gaps](#10-known-gaps).

**Acceptance Criteria:**

- [ ] Refresh thành công → access token mới trong body + cookie refresh token mới được set; refresh token cũ (cookie cũ) không dùng lại được.
- [ ] Request `/auth/refresh` không có cookie refresh token → 401.
- [ ] Refresh token hết hạn → 401.
- [ ] Dùng lại refresh token đã revoked → 401 + toàn bộ refresh token khác của user bị revoke (verify bằng cách gọi `/auth/refresh` với refresh token khác của cùng user → cũng 401).
- [ ] KHÔNG assert rằng access token cũ bị vô hiệu ngay — điều đó sai với thiết kế hiện tại (access token vẫn sống tới hết TTL).

**Tests:**

- refresh success + rotation (cookie cũ không dùng lại được).
- refresh với cookie thiếu/hết hạn.
- reuse detection: dùng cookie đã rotate → tất cả refresh token khác của user cũng bị revoke.

---

### STEP 13 — JwtAuthGuard — 🔴 Chưa làm

**Goal:** Guard xác thực access token, gắn `CurrentUser` vào request.

**Files:** `../../src/auth/guards/jwt-auth.guard.ts`, `src/auth/strategies/jwt.strategy.ts`

**Implementation:**

- `JwtStrategy` verify chữ ký + hạn access token, trả payload đã decode.
- `JwtAuthGuard` extend `AuthGuard('jwt')` từ Passport.

**Acceptance Criteria:**

- [ ] Request không có header `Authorization` → 401.
- [ ] Access token hết hạn/sai chữ ký → 401.
- [ ] Access token hợp lệ → `request.user` có payload đúng.

---

### STEP 14 — `@CurrentUser()` decorator — 🔴 Chưa làm

**Goal:** Lấy user hiện tại từ request trong controller mà không cần inject `Request` thủ công.

**Implementation:** Param decorator đọc `request.user` (đã được `JwtAuthGuard` gắn vào).

**Acceptance Criteria:**

- [ ] Dùng `@CurrentUser() user: JwtPayload` trong controller trả đúng user đang đăng nhập.

---

### STEP 15 — RolesGuard + `@Roles()` — 🔴 Chưa làm

**Goal:** Chặn route theo role, tương thích role DB-driven.

**Implementation:**

- `@Roles('ADMIN')` dùng string literal như bình thường.
- `RolesGuard` đọc metadata qua `Reflector`, so khớp với mảng `roles` string lấy từ JWT payload (STEP 11) — **không** import enum cố định, vì role là data (quyết định #6).

**Acceptance Criteria:**

- [ ] Route có `@Roles('ADMIN')`, user không có role ADMIN → 403.
- [ ] User có role ADMIN → qua được.
- [ ] Thêm role mới (vd seed thêm `STAFF`) và dùng `@Roles('STAFF')` → hoạt động ngay, không cần sửa `RolesGuard`.

---

### STEP 16 — OwnershipGuard — 🔴 Chưa làm

**Goal:** Chặn user truy cập resource không thuộc về mình, tách biệt khỏi business rule phức tạp hơn.

**Implementation:**

- **Quy tắc phạm vi** (xem [6. Security Rules](#6-security-rules)): Guard chỉ xử lý ownership đơn giản `resource.userId === currentUser.id`. Business rule khác (status, payment state...) nằm ở Service, không nhét vào Guard.
- Decorator `@OwnedResource({ paramIdKey: 'id', fetch: (id, prisma) => ... })` gắn metadata lên route handler.
- `OwnershipGuard` đọc metadata, fetch resource, so sánh `userId`. Không khớp → 403 (trừ khi role ADMIN — bypass).
- Đây là **MVP implementation** — `fetch` callback query trực tiếp qua Prisma, coupling với Prisma khá chặt trong decorator metadata. Chấp nhận được cho MVP; xem [10. Known Gaps](#10-known-gaps) về hướng cải tiến (resolver/registry pattern theo resource type).
- Auth module chỉ cung cấp guard + decorator generic; áp dụng cụ thể khi build Order/Cart module sau.

**Acceptance Criteria:**

- [ ] Guard compile/chạy được dù chưa có route nào dùng tới (chưa có Order/Cart module).
- [ ] Viết 1 route test nội bộ (hoặc để dành verify khi build Order module) xác nhận user A không truy cập được resource của user B.

---

### STEP 17 — `GET /auth/me` — 🔴 Chưa làm

**Goal:** Trả thông tin user hiện tại, không leak field nhạy cảm.

**Implementation:** Dùng `AuthUserResponseDto` (xem [6. Security Rules](#6-security-rules)).

**Acceptance Criteria:**

- [ ] Có token hợp lệ → trả đúng thông tin user.
- [ ] Không có token → 401.
- [ ] Response không chứa `passwordHash`, `tokenHash`, hay field DB nội bộ khác.

---

### STEP 18 — Logout (`POST /auth/logout`) — 🔴 Chưa làm

**Goal:** Kết thúc 1 session (1 refresh token).

**Implementation:**

- Đọc refresh token từ cookie (quyết định #17) → revoke đúng 1 refresh token đó (`revokedAt = now()`).
- Xoá cookie refresh token (`response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: <cùng path đã dùng ở STEP 10/12> })`) — **`path` phải khớp chính xác từng ký tự** với path lúc set cookie, nếu không `clearCookie` sẽ không xoá được cookie đó (lỗi rất dễ gặp nếu prefix route đổi mà quên sửa đồng bộ).
- Response: `MessageResponseDto` (xem [6. Security Rules](#6-security-rules)).

**Acceptance Criteria:**

- [ ] Logout thành công → refresh token đó không dùng để `/auth/refresh` được nữa; cookie bị xoá.
- [ ] Logout không ảnh hưởng session khác của cùng user.

---

### STEP 19 — Logout All (`POST /auth/logout-all`) — 🔴 Chưa làm

**Goal:** Kết thúc toàn bộ session của user hiện tại.

**Implementation:**

- `UPDATE refresh_tokens SET revokedAt = now() WHERE userId = current AND revokedAt IS NULL`.
- Xoá cookie refresh token hiện tại (`clearCookie` với cùng `path` đã dùng lúc set — xem lưu ý ở STEP 18).
- Response: `MessageResponseDto`.

**Acceptance Criteria:**

- [ ] Sau logout-all, mọi refresh token trước đó của user đều không dùng được; cookie hiện tại bị xoá.
- [ ] **Nhớ bổ sung dòng `POST /auth/logout-all` vào bảng tổng kết API ở `../module-auth.md` mục 26`** (hiện đang thiếu — xem STEP 24).

---

### STEP A — Forgot Password (`POST /auth/forgot-password`) — 🔴 Chưa làm

**Goal:** Cho phép yêu cầu reset password mà không lộ thông tin email tồn tại.

**Files:** `../../src/auth/dto/forgot-password.dto.ts`

**CLI:**

```powershell
New-Item src/auth/dto/forgot-password.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/forgot-password.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

- Luôn trả message chung chung ("If the account exists, a reset link has been sent.") bất kể email tồn tại hay không (quyết định #10).
- Nếu user tồn tại: xoá token cũ (STEP 7) → tạo token mới → **commit transaction trước, gửi email sau** (giống STEP 5.5).

**Acceptance Criteria:**

- [ ] Response luôn cùng 1 dạng bất kể email tồn tại hay không.
- [ ] Email tồn tại → token mới được tạo, email được gửi.

**Tests:**

- forgot-password với email tồn tại.
- forgot-password với email không tồn tại → response giống hệt case tồn tại.

---

### STEP B — Reset Password (`POST /auth/reset-password`) — 🔴 Chưa làm

**Goal:** Đặt lại password bằng token, thu hồi toàn bộ session cũ.

**Files:** `../../src/auth/dto/reset-password.dto.ts`

**CLI:**

```powershell
New-Item src/auth/dto/reset-password.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/reset-password.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

- Hash token → tìm → check hết hạn/đã dùng → validate password mới (STEP 6).
- Transaction: update `passwordHash`, `token.usedAt = now()`, **revoke toàn bộ refresh tokens** của user.
- Lưu ý giống STEP 12: revoke refresh token không thu hồi access token đang sống — chấp nhận được vì TTL ngắn.

**Acceptance Criteria:**

- [ ] Reset thành công → password mới hoạt động, password cũ không login được nữa.
- [ ] Tất cả refresh token cũ của user bị revoke (verify qua `/auth/refresh`).
- [ ] Token hết hạn/đã dùng → 400.
- [ ] Password mới không đủ policy hoặc không khớp `confirmPassword` → 400.

**Tests:**

- reset-password success + verify tất cả session cũ bị logout (refresh token cũ không dùng được).
- reset-password với token hết hạn.
- reset-password với token đã dùng.

---

### STEP 20 — Rate limiting — 🔴 Chưa làm

**Goal:** Giảm rủi ro spam/brute-force/enumeration trên các endpoint public-facing (quyết định #11 — mở rộng phạm vi so với bản trước).

**CLI:**

```bash
npm install @nestjs/throttler
```

**Implementation:**

- Áp dụng `@nestjs/throttler` cho: `login`, `forgot-password`, `resend-verification`, `register`, `verify-email`, `refresh`.
- ⚠️ **Mặc định `@nestjs/throttler` track theo request identity/IP (`req.ip`), KHÔNG tự có per-email tracking.** Muốn giới hạn "1 request / 60 giây / email" (như `forgot-password`/`resend-verification` dưới đây) phải viết **custom `ThrottlerGuard`/tracker riêng**, tự build key từ email đã normalize (lowercase, trim) trong body request — ví dụ key `forgot-password:user@example.com` — không phải chỉ khai `@Throttle()` là có sẵn theo email. Không giả định sai chỗ này khi implement.
- Threshold khác nhau tuỳ mức độ nhạy cảm. Các số dưới đây là **giá trị khởi điểm (starting values) để implement, không phải security guarantee cố định** — cần tune lại theo traffic thực tế khi lên production (theo dõi rate 429 thật, false-positive với user hợp lệ...):
  - `login`: 5 request / phút / IP (default tracker của throttler, không cần custom).
  - `forgot-password`, `resend-verification`: 1 request / 60 giây / email — **cần custom tracker theo email** như trên.
  - `register`, `verify-email`, `refresh`: threshold rộng hơn (vd 20 request / phút / IP, default tracker) — chủ yếu chặn abuse, không chặn UX bình thường.

**Acceptance Criteria:**

- [ ] Vượt threshold trên từng endpoint → 429.
- [ ] Threshold không quá chặt tới mức chặn UX bình thường (vd 1 lần login sai rồi login đúng ngay sau không bị chặn).

---

### STEP 21 — Unit test — 🔴 Chưa làm

**Goal:** Toàn bộ service có business logic (`AuthService`, `TokenService`, `PasswordService`) có unit test.

**CLI:**

```bash
npm run test
npm run test:watch   # khi đang code
npm run test:cov      # coverage — xem STEP 24/DoD về threshold
```

**Acceptance Criteria:** xem test matrix đầy đủ ở [8. Testing Strategy](#8-testing-strategy).

---

### STEP 22 — E2E test — 🔴 Chưa làm

**Goal:** Toàn bộ flow `/auth/*` có e2e test — bắt buộc theo `../convention/api-conventions.md`.

**CLI:**

```bash
npm run test:e2e   # đảm bảo DATABASE_URL trỏ DB test trước khi chạy
```

**Acceptance Criteria:** xem test matrix ở [8. Testing Strategy](#8-testing-strategy), đặc biệt case reuse detection và rotation ở `/auth/refresh`.

---

### STEP 23 — Swagger/OpenAPI — 🔴 Chưa làm

**Goal:** Toàn bộ endpoint `/auth/*` có Swagger doc đúng contract.

**Implementation:** `@ApiProperty` trong mọi DTO theo `../convention/api-conventions.md`.

**CLI:**

```bash
npm run start:dev
# mở http://localhost:<port>/api (hoặc path Swagger đã cấu hình trong main.ts) để kiểm tra
```

**Acceptance Criteria:**

- [ ] Mọi endpoint `/auth/*` xuất hiện trong Swagger UI với request/response schema đúng.

---

### STEP 24 — Đồng bộ lại `../module-auth.md` + quality check cuối — 🟡 Một phần trùng hợp đã có, chưa tính là xong

**Goal:** Hai tài liệu (`../module-auth.md` và playbook này) không lệch nhau; code sạch trước khi mở PR.

⚠️ **Ghi chú audit (2026-09-11):**

- `../module-auth.md` hiện đang ở trạng thái git rối: bản **staged là file rỗng**, còn nội dung đầy đủ (bản gốc trước khi có playbook) đang nằm ở **working tree, chưa stage**. Nếu commit ngay lúc này sẽ commit nhầm file rỗng và mất nội dung — cần `git add doc/module-auth.md` lại (sau khi đã sửa theo checklist dưới) trước khi commit. Không tự ý chạy lệnh git thay đổi staging nếu chưa chắc chắn nội dung nào là bản đúng cần giữ.
- Dòng `POST /auth/logout-all` trong bảng API mục 26 **đã có sẵn** trong nội dung hiện tại — đây là trùng hợp từ bản gốc, không phải do đã chạy STEP 24. Không cần sửa mục này nữa, nhưng 5 mục còn lại dưới đây vẫn **chưa có**.

**Implementation — cập nhật `../module-auth.md`:**

- [x] ~~Bổ sung `POST /auth/logout-all` vào bảng API mục 26.~~ — đã có sẵn trong nội dung hiện tại, không cần sửa.
- [ ] Bổ sung đoạn mô tả reuse detection (và giới hạn access-token) vào mục 12–13. — chưa có.
- [ ] Bổ sung đoạn admin bootstrap (mục mới, sau mục 2). — chưa có.
- [ ] Làm rõ 2 trục trạng thái (Account status vs Email verification) ở mục 6. — chưa có (mục 6 hiện chỉ có "Email Verification" chung chung, chưa tách 2 trục).
- [ ] Ghi rõ password policy cụ thể ở mục 4/5. — chưa có.
- [ ] Ghi chú Ownership check dùng guard/decorator dùng chung — mục 23. — chưa có (chỉ có nhắc "Ownership" chung chung ở vài chỗ, không phải ghi chú dành riêng).

**CLI — quality check:**

```bash
npm run lint
npm run format
npm run build
```

**Acceptance Criteria:** xem [9. Definition of Done](#9-definition-of-done).

---

### Sau khi xong Auth MVP

Chỉ bắt đầu build/guard các module ecommerce khác (Products, Categories, Cart, Orders, Inventory) sau khi playbook này hoàn thành — `../convention/api-conventions.md` đã flag "chưa có auth/guard nào trong project" là **gap blocking** với mọi endpoint chạm dữ liệu nhạy cảm. Khi build Order module, áp dụng `OwnershipGuard` (STEP 16) + rule "chỉ PENDING mới cancel được" (quyết định #7).

**CLI tham khảo nếu về sau schema có thay đổi** (MVP hiện tại KHÔNG cần — schema đã đủ):

```bash
npx prisma migrate dev --name <migration_name> --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
```

---

## 5. Endpoint Acceptance Criteria — bảng tham chiếu nhanh

Chi tiết đầy đủ nằm trong từng STEP ở mục 4 (mỗi endpoint có block Acceptance Criteria + Tests riêng). Bảng dưới đây chỉ để tra cứu nhanh endpoint ↔ step, dùng khi lập ticket/subtask:

| Endpoint                         | Step         | Success                                                        | Errors chính                             |
| -------------------------------- | ------------ | -------------------------------------------------------------- | ---------------------------------------- |
| `POST /auth/register`            | STEP 5.1–5.6 | 201, user tạo + email gửi                                      | 400, 409                                 |
| `POST /auth/verify-email`        | STEP 8       | emailVerifiedAt được set                                       | 400 (hết hạn/không tồn tại/đã dùng)      |
| `POST /auth/resend-verification` | STEP 9       | message chung chung, token mới nếu hợp lệ                      | không có lỗi lộ enumeration              |
| `POST /auth/login`               | STEP 10      | access token (body) + refresh token (cookie)                   | 401 (generic), block BLOCKED/chưa verify |
| `POST /auth/refresh`             | STEP 12      | access token mới (body) + refresh token mới (cookie, rotation) | 401 + revoke toàn bộ session nếu reuse   |
| `POST /auth/logout`              | STEP 18      | revoke 1 refresh token + xoá cookie                            | 401 nếu chưa login                       |
| `POST /auth/logout-all`          | STEP 19      | revoke toàn bộ refresh token + xoá cookie                      | 401 nếu chưa login                       |
| `POST /auth/forgot-password`     | STEP A       | message chung chung                                            | không có lỗi lộ enumeration              |
| `POST /auth/reset-password`      | STEP B       | password mới + revoke toàn bộ session                          | 400 (hết hạn/đã dùng/policy)             |
| `GET /auth/me`                   | STEP 17      | AuthUserResponseDto                                            | 401                                      |

---

## 6. Security Rules

- Không lưu raw password.
- Không lưu raw refresh/reset/verification token — chỉ lưu hash.
- Không log password/token (kể cả log lỗi).
- Forgot password không expose user existence.
- Resend verification không expose user existence.
- Access token TTL ngắn (15 phút).
- Refresh token có rotation + reuse detection — **nhưng reuse detection không thu hồi access token đã phát hành**, chỉ giới hạn thiệt hại bằng TTL ngắn (xem STEP 12, [10. Known Gaps](#10-known-gaps)).
- Password reset revoke toàn bộ refresh session cũ.
- Secrets chỉ đọc qua `ConfigService`, không dùng `process.env` trực tiếp (trừ `../../prisma/seed.ts`).
- Không trả Prisma `User` (hay bất kỳ Prisma model nào) trực tiếp ra API — luôn qua Response DTO allow-list.
- Auth endpoints nhạy cảm (`login`, `forgot-password`, `resend-verification`, `register`, `verify-email`, `refresh`) phải rate limit (quyết định #11).
- Refresh token luôn nằm trong cookie `HttpOnly` + `Secure` + `SameSite` + `path` giới hạn theo route auth thực tế, **không bao giờ** xuất hiện trong response body hay query string (quyết định #17).
- **Cross-origin frontend/backend** (frontend deploy ở domain/subdomain khác backend): xem [10. Known Gaps](#10-known-gaps) — cần đồng bộ cấu hình `SameSite`, CORS `credentials`, và frontend phải gửi `credentials: 'include'`, nếu không cookie sẽ không được browser gửi kèm request.
- **Guard vs Service**: Guard chỉ xử lý access-level rule (JWT hợp lệ? có role? có phải chủ resource?). Business-level rule (trạng thái đơn hàng, payment state, ràng buộc nghiệp vụ khác) luôn nằm ở Service, không nhét vào Guard.
  - Ví dụ: `GET /orders/:id` → chỉ cần `OwnershipGuard`.
  - `POST /orders/:id/cancel` → ownership **không đủ**, cần thêm `status === PENDING` (quyết định #7) — kiểm tra này nằm trong `OrderService`, không phải Guard.

### Response DTO bắt buộc

Toàn bộ endpoint `/auth/*` trả qua Response DTO allow-list — không có endpoint nào trả thẳng object nội bộ:

```ts
class AuthUserResponseDto {
  id: string;
  email: string;
  fullName: string | null;
  roles: string[];
  emailVerified: boolean;
}

class LoginResponseDto {
  accessToken: string;
  user: AuthUserResponseDto;
  // KHÔNG có refreshToken — nằm trong cookie (quyết định #17)
}

class RefreshResponseDto {
  accessToken: string;
  // KHÔNG có refreshToken — cookie mới được set qua Set-Cookie header, không lặp lại trong body
}

class RegisterResponseDto {
  id: string;
  email: string;
  // KHÔNG có accessToken/refreshToken — register không tự động login (quyết định #1)
}

class MessageResponseDto {
  message: string;
  // dùng cho: verify-email, resend-verification, forgot-password, reset-password, logout, logout-all
}
```

| Endpoint                         | DTO                   |
| -------------------------------- | --------------------- |
| `POST /auth/register`            | `RegisterResponseDto` |
| `POST /auth/verify-email`        | `MessageResponseDto`  |
| `POST /auth/resend-verification` | `MessageResponseDto`  |
| `POST /auth/login`               | `LoginResponseDto`    |
| `POST /auth/refresh`             | `RefreshResponseDto`  |
| `POST /auth/logout`              | `MessageResponseDto`  |
| `POST /auth/logout-all`          | `MessageResponseDto`  |
| `POST /auth/forgot-password`     | `MessageResponseDto`  |
| `POST /auth/reset-password`      | `MessageResponseDto`  |
| `GET /auth/me`                   | `AuthUserResponseDto` |

Không bao giờ trả: `passwordHash`, `refreshTokens`/refresh token thô (dù trong body hay log), `tokenHash`, hay bất kỳ metadata DB nội bộ nào khác.

---

## 7. Shared Services

| Service           | Trách nhiệm                                                                                       | Vị trí                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `AuthService`     | Orchestrate business flow (register/login/refresh/...), gọi các service bên dưới theo đúng thứ tự | `../../src/auth/services/auth.service.ts`                           |
| `PasswordService` | Hash / verify password (argon2)                                                                   | `../../src/auth/services/password.service.ts`                       |
| `TokenService`    | Generate + hash token (email verification / password reset / refresh); xoá token cũ chưa dùng     | `../../src/auth/services/token.service.ts`                          |
| `MailService`     | Gửi verification email / reset password email                                                     | `../../src/mail/mail.service.ts` (module riêng, đứng ngoài `auth/`) |
| `JwtService`      | Sinh & verify access token (built-in từ `@nestjs/jwt`)                                            | dùng trực tiếp, không cần wrap thêm                                 |

**Nguyên tắc:** `AuthService` không tự làm hết mọi việc (tránh thành God Service) — nó chỉ điều phối. Nhờ tách vậy, `PasswordService`/`TokenService` dễ unit test độc lập (không cần mock DB/HTTP).

### Contract của MailService

**MVP: inject trực tiếp class cụ thể**, không dùng TS `interface` làm token DI — TypeScript interface biến mất ở runtime, Nest không thể inject nó bằng `@Inject()` mà không có token riêng.

```ts
// src/mail/mail.service.ts
@Injectable()
export class MailService {
  async sendVerificationEmail(to: string, rawToken: string): Promise<void> { /* ... */ }
  async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> { /* ... */ }
}

// AuthService
constructor(private readonly mailService: MailService) {}
```

```text
AuthService
   ↓
MailService (class cụ thể, inject trực tiếp)
   ↓
SMTP / SES / Resend / SendGrid (implementation cụ thể, nằm trong MailService)
```

`auth` module không cần biết `MailService` gọi SMTP/SES/SendGrid nào bên trong — nhưng KHÔNG cần tách interface + DI token riêng cho MVP.

> **Chỉ tách abstraction khi thực sự cần đổi provider** (vd cần A/B giữa SES và SendGrid theo config): lúc đó mới thêm token DI dạng `Symbol`:
>
> ```ts
> export const MAIL_SERVICE = Symbol('MAIL_SERVICE');
> export interface IMailService { sendVerificationEmail(...): Promise<void>; /* ... */ }
> // provider: { provide: MAIL_SERVICE, useClass: SesMailService }
> // inject: constructor(@Inject(MAIL_SERVICE) private readonly mail: IMailService) {}
> ```
>
> Không làm việc này trước — thêm abstraction khi chưa có 2 implementation thật là over-engineering.

### Rule: Transaction không bọc external call

```text
Không nên:
DB transaction {
  create user
  create token
  send external email   ← SAI: external call trong transaction
}

Nên:
DB transaction
├── create user
├── assign role
└── create token
      ↓
commit
      ↓
send email   (ngoài transaction)
```

Nếu gửi mail fail: log lại, **không rollback DB** — user đã tồn tại hợp lệ và có thể tự resend verification (STEP 9) để nhận lại email.

---

## 8. Testing Strategy

Theo `../convention/api-conventions.md`: nhóm `auth` là **bắt buộc phải có e2e test**. Unit test bắt buộc cho mọi service có business logic (`AuthService`, `TokenService`, `PasswordService`).

| Endpoint                             | Happy path | Validation | Auth | Security | Edge case |
| ------------------------------------ | :--------: | :--------: | :--: | :------: | :-------: |
| register                             |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| verify-email                         |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| resend-verification                  |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| login                                |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| refresh (rotation + reuse detection) |     ✓      |     ✓      |  ✓   |    ✓     |     ✓     |
| logout                               |     ✓      |     –      |  ✓   |    –     |     ✓     |
| logout-all                           |     ✓      |     –      |  ✓   |    –     |     ✓     |
| forgot-password                      |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| reset-password                       |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| /auth/me                             |     ✓      |     –      |  ✓   |    ✓     |     –     |
| RolesGuard                           |     ✓      |     –      |  ✓   |    ✓     |     ✓     |
| OwnershipGuard                       |     ✓      |     –      |  ✓   |    ✓     |     ✓     |
| Rate limiting (per endpoint)         |     ✓      |     –      |  –   |    ✓     |     ✓     |

"Security" cột ở trên = test riêng cho các rule ở mục 6 (không leak field, không lộ enumeration, rate limit có hoạt động, reuse detection có revoke đúng phạm vi...).

---

## 9. Definition of Done

Auth MVP chỉ được coi là hoàn thành khi:

- [ ] Register hoạt động
- [ ] Verify email hoạt động
- [ ] Resend verification hoạt động
- [ ] Login chặn unverified user
- [ ] Login chặn BLOCKED user
- [ ] Access token hoạt động
- [ ] Refresh rotation hoạt động
- [ ] Reuse detection hoạt động (đúng phạm vi: chỉ revoke refresh token, không claim revoke access token)
- [ ] Logout hoạt động
- [ ] Logout all hoạt động
- [ ] Forgot/reset password hoạt động
- [ ] Password reset revoke toàn bộ refresh session
- [ ] JwtAuthGuard hoạt động
- [ ] RolesGuard hoạt động
- [ ] OwnershipGuard hoạt động (chỉ ownership, business rule để ở Service)
- [ ] Rate limiting hoạt động trên `login`, `forgot-password`, `resend-verification`, `register`, `verify-email`, `refresh` (per-email tracking cho 2 endpoint cần custom, không phải default throttler)
- [ ] Refresh token luôn nằm trong cookie `HttpOnly`+`Secure`+`SameSite`, không bao giờ xuất hiện trong response body/log
- [ ] Mọi response `/auth/*` dùng đúng Response DTO ở bảng mục 6 (không có endpoint nào trả object nội bộ)
- [ ] Không leak sensitive field (passwordHash, tokenHash...) qua bất kỳ response nào
- [ ] Toàn bộ error response của `/auth/*` tuân theo error envelope chung `{ statusCode, message }` (theo `../convention/api-conventions.md` §7 — lưu ý `PrismaExceptionFilter` global **chưa được implement** trong repo, là gap đã biết non-blocking; lỗi domain đã biết trước ở auth (409 email tồn tại, 401 sai credential...) phải tự ném exception có message rõ ràng ở service, không phó mặc cho filter chưa tồn tại)
- [ ] Unit tests pass (`npm run test`)
- [ ] `npm run test:cov` đạt threshold coverage của project
- [ ] E2E tests pass (`npm run test:e2e`, bắt buộc theo `../convention/api-conventions.md`)
- [ ] Swagger đúng contract
- [ ] `npm run lint` pass
- [ ] `npm run format` (hoặc format check) pass
- [ ] `npm run build` pass
- [ ] Không có secret/token/password nào xuất hiện trong log
- [ ] `../module-auth.md` đã đồng bộ lại (STEP 24)
- [ ] PR reviewed

---

## 10. Known Gaps

Các điểm cố ý để ngoài scope MVP này, ghi lại để không bị quên và không bị hiểu nhầm là thiếu sót:

- **Access-token revocation tức thời** — Reuse detection (quyết định #3) chỉ revoke được refresh token; access token JWT đã phát hành vẫn hợp lệ tới khi hết TTL (15 phút) vì là stateless token. Nếu cần thu hồi access token ngay lập tức (vd tài khoản bị compromise nghiêm trọng), cần thêm cơ chế denylist (Redis TTL theo `jti`) hoặc token-version trong `User` (increment version → middleware so khớp version trong JWT payload với version hiện tại của user). **Chưa cần cho MVP** vì TTL ngắn đã giới hạn thiệt hại.
- **CSRF protection cho cookie-based refresh** — `/auth/refresh` và `/auth/logout` đọc refresh token từ cookie (quyết định #17), browser tự động gửi cookie kèm mọi request cùng origin → có rủi ro CSRF về lý thuyết trên các endpoint này. MVP giảm rủi ro bằng `SameSite=Strict/Lax`, **chưa implement CSRF token riêng (double-submit cookie hoặc header đồng bộ)**. Cân nhắc thêm nếu audit bảo mật yêu cầu, hoặc nếu sau này cần `SameSite=None` (cross-origin frontend/backend).
- **Frontend/backend deploy khác origin — phân biệt rõ "cross-origin" vs "cross-site"** (2 khái niệm khác nhau, dễ nhầm dẫn tới cấu hình cookie sai):
  - **Cross-origin nhưng vẫn same-site** (khác subdomain, chung **registrable domain** — vd frontend `app.example.com` gọi API `api.example.com`): đây vẫn là **same-site** theo định nghĩa trình duyệt. `SameSite=Strict` hoặc `Lax` **vẫn hoạt động bình thường**, KHÔNG cần đổi sang `None`. Cookie chỉ cần backend nhận tại domain của chính nó (vd `api.example.com`) — **mặc định để host-only cookie (không set `Domain`)**, an toàn hơn vì browser chỉ gửi cookie đúng cho `api.example.com`, không lan sang các subdomain khác. Chỉ set `domain: '.example.com'` (cookie dùng chung nhiều subdomain) khi **thật sự** có nhu cầu đó (vd nhiều service ở nhiều subdomain cùng cần đọc cookie này) — không set mặc định "cho chắc". Ngoài ra cần CORS `credentials: true` + `origin` khai rõ subdomain frontend + frontend gọi `credentials: 'include'`.
  - **Cross-site thật sự** (registrable domain khác nhau hoàn toàn — vd frontend `shop.com` gọi API ở `vendor-api.io`): trường hợp này mới bắt buộc `sameSite: 'none'` (đi kèm `secure: true`, không hoạt động qua HTTP), cộng thêm CORS `credentials: true` + `origin` cụ thể (không thể `origin: '*'` khi `credentials: true`) + frontend `credentials: 'include'`. `SameSite=None` làm tăng bề mặt CSRF đáng kể hơn `Strict`/`Lax` — nên triển khai CSRF token riêng (xem gạch đầu dòng CSRF phía trên) cùng lúc, không để rời.
  - **Chưa làm ở MVP này** cho cả 2 case trên — playbook mặc định giả định frontend/backend cùng site đơn giản nhất (không subdomain khác nhau). Thiếu `credentials: 'include'` ở frontend (dù case nào) sẽ khiến browser **không gửi** cookie refresh token kèm request, `/auth/refresh` luôn thất bại dù cookie tồn tại trên máy client — lỗi này dễ nhầm với bug backend nên cần lưu ý riêng.
- **MailService abstraction (interface + DI token)** — MVP inject trực tiếp class `MailService` cụ thể (xem mục 7), chưa tách interface + `Symbol` token. Chỉ cần làm khi thực sự có ≥ 2 provider email cần đổi qua lại theo config.
- **Refresh token session family (`familyId`)** — MVP hiện revoke **toàn bộ** active refresh session khi phát hiện reuse. Nếu sau này muốn revoke theo từng token family/device thay vì toàn account, cần bổ sung schema:
  ```text
  RefreshToken
  ├── id
  ├── userId
  ├── familyId
  ├── tokenHash
  ├── revokedAt
  └── replacedByTokenId
  ```
  Cải tiến tương lai, **không bắt buộc cho MVP**.
- **OwnershipGuard coupling với Prisma** — implementation MVP dùng callback `fetch` trực tiếp trong decorator metadata (STEP 16), gây coupling khá mạnh với Prisma. Hướng cải tiến tương lai: `@OwnedResource('order')` + guard gọi qua một provider/registry chuyên resolve ownership theo resource type, tách khỏi Prisma trực tiếp. **Không cần đổi ngay.**
- **MFA (2FA)** — ngoài scope, cân nhắc khi có yêu cầu bảo mật cao hơn (vd tài khoản ADMIN).
- **Social login** — ngoài scope.
- **Account lockout theo số lần sai password** — ngoài scope MVP (quyết định #4); rate limiting theo IP tạm thời thay thế.
- **Device fingerprinting** — ngoài scope. Vì vậy thuật ngữ "Session" (quyết định #14) chỉ là phiên đăng nhập logic, không xác thực được đây có đúng là 1 thiết bị vật lý hay không.
- **SSO** — ngoài scope.
- **Permission matrix nâng cao** (permission rời rạc ngoài Role + Ownership) — ngoài scope; Role + Ownership + business rule trong Service là đủ cho MVP.
- **`../module-auth.md` cần đồng bộ lại** theo STEP 24 — chưa làm thì hai file sẽ lệch nhau.
