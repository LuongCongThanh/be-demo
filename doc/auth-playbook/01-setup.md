# 01 — Setup: hạ tầng dùng chung

> ⬅️ Trước khi làm file này: đọc [00-overview.md](./00-overview.md) (Scope, Decisions, Security Rules, Response DTO...) — đây là file đầu tiên trong chuỗi implement, chưa có file `0X-...` nào khác cần hoàn thành trước.
> 📚 Tham chiếu chung (Decisions, Security Rules, Response DTO...): [00-overview.md](./00-overview.md).
> File này gom mọi thứ **dùng chung cho nhiều endpoint** (glossary, seed data, package, env, khung module, password policy, TokenService đầy đủ) — làm xong toàn bộ file này 1 lần trước khi bắt đầu viết bất kỳ endpoint nào ở các file `02-...` trở đi.

> **Quy ước shell:** các lệnh `npm`/`npx` chạy giống nhau trên mọi shell. Lệnh tạo file/folder rỗng (touch-style) khác nhau giữa PowerShell và Bash (Git Bash/WSL) nên được ghi **riêng từng block có nhãn** — chọn theo shell bạn đang dùng, không trộn cú pháp.

---

## STEP 0 — Cập nhật CONTEXT.md — 🔴 Chưa làm

**Goal:** CONTEXT.md phản ánh đúng domain ecommerce hiện tại, bắt đầu từ glossary Auth.

**Files:** `CONTEXT.md`

> 📘 **Khái niệm — vì sao cần `CONTEXT.md` riêng, không viết thẳng vào code?**
> `CONTEXT.md` là **glossary domain** — nơi định nghĩa thuật ngữ nghiệp vụ (User, Role, Session nghĩa là gì trong app này) tách khỏi chi tiết kỹ thuật (TTL bao lâu, hash bằng thuật toán gì). Dev mới (hoặc AI agent) đọc file này trước để hiểu "ngôn ngữ chung" của domain, rồi mới đọc playbook để biết cách implement. Nếu gộp 2 thứ vào 1 chỗ, glossary sẽ phình to và lẫn lộn giữa "khái niệm" và "cách làm".

**Implementation:**

1. Mở `CONTEXT.md` — nội dung hiện tại mô tả domain "Todo List" cũ, không còn đúng. Xoá toàn bộ, viết lại từ đầu.
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

## STEP 1 — Seed roles + admin bootstrap — 🔴 Chưa làm

**Goal:** Có sẵn role `ADMIN`/`CUSTOMER` và 1 tài khoản ADMIN đầu tiên khi hệ thống khởi động lần đầu.

**Files:** `prisma/seed.ts`, `package.json` (thêm script `db:seed`)

⚠️ **`prisma/seed.ts` đã tồn tại trong repo — nhưng KHÔNG phải seed logic Auth.** File hiện tại là seed script cũ của app Todo trước đây (`prisma.todo.createMany(...)` với dữ liệu mẫu tiếng Việt), không seed role/admin gì cả. **Đừng bỏ qua step này vì "file đã có"** — mở file hiện có và **thay thế toàn bộ nội dung**, không chạy CLI tạo file mới (sẽ báo lỗi file đã tồn tại).

> 📘 **Khái niệm — vì sao seed phải "idempotent" (chạy lại nhiều lần không tạo trùng)?**
> Seed script thường được chạy lại nhiều lần: mỗi lần setup máy dev mới, mỗi lần CI build DB test, mỗi lần deploy lại. Nếu seed dùng `create()` thẳng, chạy lần 2 sẽ báo lỗi trùng unique key (`email`, `name`) hoặc tạo ra 2 role `ADMIN` khác nhau. Prisma có sẵn `upsert()`: "nếu đã tồn tại (theo điều kiện `where`) thì update, chưa có thì tạo mới" — dùng đúng 1 lần gọi để vừa tạo vừa không trùng.

**Implementation:**

1. Đảm bảo `package.json` → `"scripts"` có dòng (chưa có, thêm mới):

   ```json
   "db:seed": "tsx prisma/seed.ts"
   ```

2. Viết lại toàn bộ `prisma/seed.ts`:

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
       throw new Error(
         'Thiếu ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD trong .env',
       );
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
         roles: { create: [{ roleId: adminRole.id }] },
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

   > ⚠️ Tên field/relation (`roles`, `roleId`, `status`, `emailVerifiedAt`...) phải khớp đúng với `prisma/schema.prisma` hiện tại — mở file schema đối chiếu trước khi paste code trên, sửa lại tên field nếu khác.

3. Không tạo endpoint HTTP nào để tạo ADMIN — chỉ qua seed script (giảm bề mặt tấn công, quyết định #16).

**Acceptance Criteria:**

- [ ] Chạy `npm run db:seed` nhiều lần không tạo trùng role/admin.
- [ ] Sau khi seed, DB có ít nhất role `ADMIN` và `CUSTOMER` và 1 user ADMIN.

**CLI (chạy sau khi code xong):**

```bash
npm run db:seed
```

---

## STEP 2 — Cài package — 🔴 Chưa làm

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

> Chưa cài `@nestjs/throttler` ở bước này — xem [12-rate-limiting.md](./12-rate-limiting.md).

**Acceptance Criteria:**

- [ ] `package.json` có đủ 4 dependency + 1 devDependency ở trên.

---

## STEP 3 — Env vars — 🔴 Chưa làm

**Goal:** Toàn bộ config nhạy cảm đọc qua `ConfigService`, có file mẫu cho dev khác.

**Files:** `.env.example`, `.env` (local, không commit)

> 📘 **Khái niệm — `ConfigService` là gì, vì sao không dùng `process.env.XXX` thẳng trong code?**
> `ConfigService` (từ `@nestjs/config`) là 1 service được NestJS "tiêm" (dependency injection — DI, xem giải thích đầy đủ ở STEP 4) vào bất kỳ class nào cần đọc config, thay vì gọi `process.env.XXX` rải rác khắp nơi. Lợi ích: (1) test dễ hơn — mock `ConfigService` thay vì mock biến môi trường thật của process; (2) một chỗ duy nhất kiểm soát giá trị mặc định/validate; (3) tránh gõ sai tên biến env ở nhiều chỗ khác nhau mà không ai biết. Ngoại lệ duy nhất là `prisma/seed.ts` (STEP 1) vì nó chạy ngoài Nest DI container.

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

> ⚠️ Không có `JWT_REFRESH_SECRET` — refresh token trong thiết kế này là **opaque random token** (không phải JWT), chỉ lưu dạng hash trong DB (`refresh_tokens.tokenHash`). Không cần secret để ký/verify nó, chỉ cần so khớp hash khi tra DB. Xem [06-refresh-token.md](./06-refresh-token.md).

```bash
# Sinh secret ngẫu nhiên để dán vào .env local (chạy được trên cả 2 shell qua Node)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Sau khi tạo `.env.example`, copy thành `.env` và điền giá trị thật (secret vừa sinh, `DATABASE_URL` thật, email/password admin bootstrap):

```powershell
Copy-Item .env.example .env   # PowerShell
```

```bash
cp .env.example .env   # Bash (Git Bash/WSL)
```

**Acceptance Criteria:**

- [ ] `.env.example` tồn tại, không chứa giá trị thật.
- [ ] `.env` local có giá trị thật, không được commit (`.gitignore` đã có `.env` — kiểm tra lại).
- [ ] Không có `process.env.XXX` nào được gọi trực tiếp trong code auth (trừ `prisma/seed.ts`).

---

## STEP 4 — Scaffold module — 🔴 Chưa làm

**Goal:** Có khung thư mục đúng kiến trúc, sẵn sàng để điền logic.

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

Cuối cùng, mở `src/app.module.ts` và thêm `AuthModule`, `MailModule` vào mảng `imports` (CLI `nest g module` thường đã tự làm việc này — kiểm tra lại, không giả định):

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

- [ ] `src/app.module.ts` đã import `AuthModule` và `MailModule`.
- [ ] `npm run build` không lỗi (dù logic bên trong chưa hoàn thiện, file rỗng vẫn build được).

---

## STEP 6 — Password policy — 🔴 Chưa làm

**Goal:** Password đáp ứng quyết định #9 (hoa + thường + số + ký tự đặc biệt, ≥ 8 ký tự) — dùng chung cho `RegisterDto` (02-register.md) và `ResetPasswordDto` (11-reset-password.md).

**Files:** không tạo file riêng — viết trực tiếp vào từng DTO cần validate password, hoặc (khuyến nghị) tách thành 1 custom decorator dùng chung để không lặp code.

> 📘 **Khái niệm — vì sao nên tách thành decorator dùng chung thay vì copy-paste regex 2 lần?** `RegisterDto` và `ResetPasswordDto` đều cần đúng 1 rule password. Nếu copy `@Matches(regex)` vào 2 file, sau này đổi policy (vd tăng độ dài tối thiểu) phải nhớ sửa cả 2 chỗ — dễ sót. Gom vào 1 decorator dùng lại (`@IsStrongPassword()`) chỉ cần sửa 1 nơi.

**Implementation:**

1. Tạo file `src/auth/decorators/is-strong-password.decorator.ts`:

   ```ts
   // src/auth/decorators/is-strong-password.decorator.ts
   import { applyDecorators } from '@nestjs/common';
   import { Matches, MinLength } from 'class-validator';

   /**
    * Password: tối thiểu 8 ký tự, có chữ hoa + chữ thường + số + ký tự đặc biệt
    * (quyết định #9). Dùng chung cho RegisterDto và ResetPasswordDto.
    */
   export function IsStrongPassword() {
     return applyDecorators(
       MinLength(8),
       Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
         message:
           'Password phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt',
       }),
     );
   }
   ```

2. Dùng trong DTO thay vì lặp lại 2 decorator:

   ```ts
   import { IsString } from 'class-validator';
   import { IsStrongPassword } from '../decorators/is-strong-password.decorator';

   export class RegisterDto {
     // ...
     @IsString()
     @IsStrongPassword()
     password: string;
   }
   ```

   > Nếu đã lỡ viết trực tiếp `@MinLength(8)` + `@Matches(...)` vào `RegisterDto` ở 02-register.md (STEP 5.1), quay lại thay bằng `@IsStrongPassword()` khi làm tới step này — không bắt buộc làm ngay lập tức nếu 02-register.md đã xong và chạy được, nhưng nên dọn lại trước khi làm 11-reset-password.md để không copy-paste regex lần 2.

**Acceptance Criteria:**

- [ ] Password `abc12345` (thiếu hoa + ký tự đặc biệt) → 400.
- [ ] Password `Abc@1234` → hợp lệ.
- [ ] `RegisterDto` và `ResetPasswordDto` cùng dùng 1 decorator `IsStrongPassword()`, không có regex trùng lặp ở 2 nơi.

---

## STEP 7 — TokenService đầy đủ — 🔴 Chưa làm

**Goal:** Generalize `TokenService` (bản tối thiểu đã viết ở 02-register.md STEP 5.3 chỉ có `createEmailVerificationToken`) thành service dùng chung cho **cả 3 loại token**: email verification, password reset, refresh token.

**Files:** `src/auth/services/token.service.ts` (sửa lại, không tạo file mới)

**Implementation:**

> 📘 **Khái niệm — vì sao gom 3 loại token vào 1 service thay vì 3 service riêng?** Cả 3 loại token (email verification, password reset, refresh) đều theo đúng 1 pattern: sinh random bytes → hash SHA-256 → lưu hash + `expiresAt` → raw token chỉ tồn tại thoáng qua lúc tạo. Chỉ khác **model Prisma nào được ghi** và **TTL bao lâu**. Viết 1 hàm generate/hash dùng chung, các method public chỉ khác nhau ở việc gọi đúng model.

```ts
// src/auth/services/token.service.ts
import { randomBytes, createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service'; // chỉnh lại path đúng repo
import ms from 'ms'; // hoặc parse TTL bằng cách bạn đang dùng sẵn trong repo (vd @nestjs/config có parse riêng)

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Sinh token ngẫu nhiên (raw) + hash SHA-256 của nó — dùng chung cho cả 3 loại token. */
  private generate(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashRawToken(rawToken);
    return { rawToken, tokenHash };
  }

  /** Hash 1 raw token nhận từ client (email link, cookie...) để so khớp với DB. */
  hashRawToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  // ---- Email Verification Token --------------------------------------

  async createEmailVerificationToken(userId: string): Promise<string> {
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId, verifiedAt: null },
    });
    const { rawToken, tokenHash } = this.generate();
    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt: this.expiryFromNow('24h') },
    });
    return rawToken;
  }

  // ---- Password Reset Token -------------------------------------------

  async createPasswordResetToken(userId: string): Promise<string> {
    // Xoá token reset cũ chưa dùng (quyết định #8) trước khi tạo mới.
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId, usedAt: null },
    });
    const { rawToken, tokenHash } = this.generate();
    await this.prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt: this.expiryFromNow('1h') },
    });
    return rawToken;
  }

  // ---- Refresh Token ----------------------------------------------------

  async createRefreshToken(userId: string): Promise<string> {
    const { rawToken, tokenHash } = this.generate();
    const ttl = this.config.get<string>('REFRESH_TOKEN_TTL', '7d');
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt: this.expiryFromNow(ttl) },
    });
    return rawToken;
  }

  // ---- Helper ------------------------------------------------------------

  private expiryFromNow(ttl: string): Date {
    return new Date(Date.now() + ms(ttl));
  }
}
```

> ⚠️ Tên model Prisma (`emailVerificationToken`, `passwordResetToken`, `refreshToken`) và field (`userId`, `tokenHash`, `expiresAt`, `verifiedAt`, `usedAt`) phải khớp đúng `prisma/schema.prisma` — đối chiếu trước khi paste. Nếu repo chưa có package `ms`, cài thêm (`npm install ms @types/ms`) hoặc tự viết hàm parse TTL đơn giản (`'15m'` → phút, `'7d'` → ngày) — miễn nhất quán trong toàn bộ `TokenService`.
>
> ⚠️ Đoạn `createVerificationTokenInTx` viết tay trong `AuthService.register()` (02-register.md STEP 5.5) là bản trùng lặp tạm thời — sau khi `TokenService` đã đầy đủ như trên, cân nhắc refactor `AuthService.register()` gọi qua `tokenService` với tham số `tx` nếu muốn dọn code (không bắt buộc cho MVP, ghi ở [00-overview.md § Known Gaps](./00-overview.md)).

**Acceptance Criteria:**

- [ ] `TokenService` không có method nào trả raw token ra ngoài trừ lúc tạo mới (để gửi email/set cookie).
- [ ] Gọi `createEmailVerificationToken` hoặc `createPasswordResetToken` 2 lần liên tiếp cho cùng user → chỉ còn 1 token loại đó hợp lệ trong DB (token cũ bị xoá trước khi tạo mới — quyết định #8).
- [ ] `createRefreshToken` tạo đúng 1 record `refresh_tokens` với TTL đọc từ `ConfigService` (`REFRESH_TOKEN_TTL`), không hardcode số ngày.

---

➡️ Tiếp theo: [02-register.md](./02-register.md)
