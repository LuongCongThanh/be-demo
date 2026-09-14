# 01 — Setup: hạ tầng dùng chung

Trước khi viết bất kỳ endpoint nào, có một mớ hạ tầng dùng chung cần dựng sẵn: glossary domain, seed data, package, biến môi trường, khung module, password policy, và `TokenService` đầy đủ. Đọc [00-overview.md](./00-overview.md) trước nếu chưa đọc (Scope, Decisions, Security Rules, Response DTO...) — đây là file đầu tiên trong chuỗi implement, chưa có file `0X-...` nào khác cần hoàn thành trước. Cần tra thuật ngữ thì mở [GLOSSARY.md](./GLOSSARY.md).

Làm xong toàn bộ 7 bước dưới đây 1 lần, rồi mới bắt đầu viết endpoint đầu tiên ở [02-register.md](./02-register.md). Một lưu ý về shell: lệnh `npm`/`npx` chạy giống nhau trên mọi hệ điều hành, nhưng lệnh tạo file/folder rỗng (kiểu `touch`) khác nhau giữa PowerShell và Bash (Git Bash/WSL) — mỗi chỗ cần tạo file trống đều có 2 block lệnh riêng, chọn đúng theo shell bạn đang dùng, đừng trộn cú pháp.

---

## Bước 0 — Cập nhật CONTEXT.md

CONTEXT.md phản ánh đúng domain ecommerce hiện tại, bắt đầu từ glossary Auth. File cần sửa: `CONTEXT.md`.

> 📘 **Khái niệm — vì sao viết `CONTEXT.md` trước khi code, và vì sao chính BẠN cần nó?**
> `CONTEXT.md` là **glossary domain** — nơi định nghĩa thuật ngữ nghiệp vụ (User, Role, Session nghĩa là gì trong app này) tách khỏi chi tiết kỹ thuật (TTL bao lâu, hash bằng thuật toán gì). Đây không phải thủ tục hình thức — là 1 bài tập nhỏ buộc bạn **tự diễn đạt lại bằng lời của mình** domain đang xây (nếu không định nghĩa nổi "Account status khác Email verification ở đâu" bằng 1-2 câu, nghĩa là bạn chưa thực sự hiểu quyết định #15 ở `00-overview.md`, và sẽ dễ code sai logic sau này). Ngoài ra, 3 tháng sau quay lại project này (hoặc 1 đồng nghiệp mới join), đọc `CONTEXT.md` sẽ nhanh hơn nhiều so với phải đọc lại toàn bộ code để đoán "Session ở đây nghĩa là gì". Tách riêng khỏi playbook implementation vì glossary trả lời "cái gì", còn playbook trả lời "làm sao" — gộp chung sẽ phình to và lẫn lộn.

Mở `CONTEXT.md` — nội dung hiện tại mô tả domain "Todo List" cũ, không còn đúng. Xoá toàn bộ, viết lại từ đầu với các mục thuật ngữ sau (chỉ định nghĩa, không viết TTL/thuật toán/tên biến):

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

Đừng thêm chi tiết implementation (TTL, thuật toán hash, tên cookie...) vào đây — những thứ đó thuộc về playbook này, không thuộc glossary. Đọc lại `CONTEXT.md` sau khi viết xong: nó không còn nhắc gì tới domain "Todo List" cũ, và chỉ chứa định nghĩa thuật ngữ thuần tuý, không lẫn implementation detail nào — nếu vẫn còn, dọn lại trước khi sang bước tiếp theo.

---

## Bước 1 — Seed roles + admin bootstrap

Mục tiêu bước này là có sẵn role `ADMIN`/`CUSTOMER` và 1 tài khoản ADMIN đầu tiên khi hệ thống khởi động lần đầu. File cần sửa: `prisma/seed.ts`, `package.json` (thêm script `db:seed`).

⚠️ **`prisma/seed.ts` đã tồn tại trong repo — nhưng KHÔNG phải seed logic Auth.** File hiện tại là seed script cũ của app Todo trước đây (`prisma.todo.createMany(...)` với dữ liệu mẫu tiếng Việt), không seed role/admin gì cả. **Đừng bỏ qua bước này vì "file đã có"** — mở file hiện có và **thay thế toàn bộ nội dung**, không chạy CLI tạo file mới (sẽ báo lỗi file đã tồn tại).

> 📘 **Khái niệm — vì sao seed phải "idempotent" (chạy lại nhiều lần không tạo trùng)?**
> Seed script thường được chạy lại nhiều lần: mỗi lần setup máy dev mới, mỗi lần CI build DB test, mỗi lần deploy lại. Nếu seed dùng `create()` thẳng, chạy lần 2 sẽ báo lỗi trùng unique key (`email`, `name`) hoặc tạo ra 2 role `ADMIN` khác nhau. Prisma có sẵn `upsert()`: "nếu đã tồn tại (theo điều kiện `where`) thì update, chưa có thì tạo mới" — dùng đúng 1 lần gọi để vừa tạo vừa không trùng.

Đảm bảo `package.json` → `"scripts"` có dòng sau (chưa có thì thêm mới):

```json
"db:seed": "tsx prisma/seed.ts"
```

Rồi viết lại toàn bộ `prisma/seed.ts`:

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

⚠️ Tên field/relation (`roles`, `roleId`, `status`, `emailVerifiedAt`...) phải khớp đúng với `prisma/schema.prisma` hiện tại — mở file schema đối chiếu trước khi paste code trên, sửa lại tên field nếu khác. Và đừng tạo endpoint HTTP nào để tạo ADMIN — chỉ qua seed script (giảm bề mặt tấn công, quyết định #16).

Chạy thử để kiểm tra:

```bash
npm run db:seed
```

Chạy lại lệnh này thêm vài lần liên tiếp — DB không được có thêm role/admin trùng lặp nào cả, và sau khi chạy xong ít nhất phải có role `ADMIN`, `CUSTOMER`, và 1 user ADMIN trong DB.

---

## Bước 2 — Cài package

Cần đủ dependency cho hashing + JWT + Passport trước khi viết code.

> 📘 **Khái niệm — từng package dùng để làm gì:**
>
> | Package               | Vai trò                                                                                                                           |
> | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
> | `argon2`              | Hash password — thuật toán hash chuyên dụng cho password (chậm có chủ đích, chống brute-force), khác hẳn hash thường như SHA-256. |
> | `@nestjs/jwt`         | Sinh và verify JWT (access token) — wrapper chính thức của Nest quanh thư viện `jsonwebtoken`.                                    |
> | `@nestjs/passport`    | Tích hợp Passport.js (thư viện auth phổ biến) vào NestJS theo kiểu Guard/Strategy.                                                |
> | `passport-jwt`        | Passport "strategy" cụ thể để verify JWT lấy từ header `Authorization: Bearer <token>`.                                           |
> | `@types/passport-jwt` | Type definition cho `passport-jwt` (package gốc viết bằng JS, không có type sẵn).                                                 |

Cài bằng:

```bash
npm install argon2 @nestjs/jwt @nestjs/passport passport-jwt
npm install -D @types/passport-jwt
```

Chưa cần cài `@nestjs/throttler` ở bước này — chuyện đó để dành cho [12-rate-limiting.md](./12-rate-limiting.md). Mở lại `package.json`, kiểm tra đủ 4 dependency + 1 devDependency ở trên là xong bước này.

---

## Bước 3 — Env vars

Toàn bộ config nhạy cảm cần đọc qua `ConfigService`, và cần có file mẫu cho dev khác. File liên quan: `.env.example`, `.env` (local, không commit).

> 📘 **Khái niệm — `ConfigService` là gì, vì sao không dùng `process.env.XXX` thẳng trong code?**
> `ConfigService` (từ `@nestjs/config`) là 1 service được NestJS "tiêm" (dependency injection — DI, xem giải thích đầy đủ ở Bước 4) vào bất kỳ class nào cần đọc config, thay vì gọi `process.env.XXX` rải rác khắp nơi. Lợi ích: (1) test dễ hơn — mock `ConfigService` thay vì mock biến môi trường thật của process; (2) một chỗ duy nhất kiểm soát giá trị mặc định/validate; (3) tránh gõ sai tên biến env ở nhiều chỗ khác nhau mà không ai biết. Ngoại lệ duy nhất là `prisma/seed.ts` (Bước 1) vì nó chạy ngoài Nest DI container.

Tạo `.env.example`:

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

⚠️ Không có `JWT_REFRESH_SECRET` — refresh token trong thiết kế này là **opaque random token** (không phải JWT), chỉ lưu dạng hash trong DB (`refresh_tokens.tokenHash`). Không cần secret để ký/verify nó, chỉ cần so khớp hash khi tra DB. Xem [06-refresh-token.md](./06-refresh-token.md).

Sinh 1 secret ngẫu nhiên để dán vào `.env` local (chạy được trên cả 2 shell qua Node):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Sau khi tạo `.env.example`, copy thành `.env` và điền giá trị thật (secret vừa sinh, `DATABASE_URL` thật, email/password admin bootstrap):

```powershell
Copy-Item .env.example .env   # PowerShell
```

```bash
cp .env.example .env   # Bash (Git Bash/WSL)
```

Kiểm tra lại: `.env.example` tồn tại và không chứa giá trị thật nào; `.env` local có giá trị thật nhưng không được commit (`.gitignore` đã có `.env` — kiểm tra lại cho chắc); và không có `process.env.XXX` nào được gọi trực tiếp trong code auth ngoại trừ `prisma/seed.ts`.

---

## Bước 4 — Scaffold module

Bước này dựng khung thư mục đúng kiến trúc, sẵn sàng để điền logic ở các bước/file sau.

> 📘 **Khái niệm nền tảng NestJS (đọc trước khi chạy CLI bên dưới):**
>
> - **Module** (`*.module.ts`) — 1 "hộp" gom nhóm các Controller + Service liên quan tới nhau (vd toàn bộ auth nằm trong `AuthModule`). App NestJS là 1 cây Module lồng nhau, gốc là `AppModule`.
> - **Controller** (`*.controller.ts`) — nhận HTTP request (route `/auth/register`...), gọi Service xử lý, trả response. Controller **không chứa business logic**, chỉ điều hướng.
> - **Service** (`*.service.ts`) — nơi chứa business logic thật (hash password, tạo user, gửi email...). Đánh dấu bằng decorator `@Injectable()`.
> - **Dependency Injection (DI)** — thay vì Controller tự `new AuthService()`, NestJS tự tạo instance `AuthService` và "tiêm" (inject) vào constructor của Controller. Lợi ích: dễ test (thay instance thật bằng mock trong unit test), dễ tái sử dụng 1 instance cho toàn app (singleton).
> - **Guard** (`*.guard.ts`) — đoạn code chạy **trước** khi request tới Controller, quyết định request có được đi tiếp hay không (vd `JwtAuthGuard` chặn request không có token hợp lệ).
> - **Decorator** (`@Something()`) — cú pháp gắn "metadata" lên class/method/param (vd `@Roles('ADMIN')` gắn thông tin "route này cần role ADMIN" lên method, để `RolesGuard` đọc lại metadata đó lúc runtime qua `Reflector`).
> - **DTO** (Data Transfer Object, `*.dto.ts`) — class định nghĩa hình dạng dữ liệu request/response (vd `RegisterDto` định nghĩa `email`, `password` client phải gửi lên), gắn kèm decorator validate (`class-validator`) để Nest tự động kiểm tra input trước khi vào Controller.

Cấu trúc thư mục bạn sẽ dựng lên trông như sau:

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

Dùng Nest CLI để dựng phần lớn cấu trúc này tự động:

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

`nest g <schematic> <path>` tự tạo file **và** tự đăng ký (import + thêm vào mảng `providers`/`controllers`) trong module gần nhất — đây là lý do dùng CLI thay vì tự tạo file tay: đỡ quên đăng ký thủ công.

Strategy và folder DTO không có schematic riêng, phải tạo thủ công:

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

Kiểm tra: `src/app.module.ts` đã import `AuthModule` và `MailModule`, và `npm run build` không lỗi (dù logic bên trong chưa hoàn thiện, file rỗng vẫn build được).

---

## Bước 5 — Password policy

Password cần đáp ứng quyết định #9 (hoa + thường + số + ký tự đặc biệt, ≥ 8 ký tự) — dùng chung cho `RegisterDto` (02-register.md) và `ResetPasswordDto` (11-reset-password.md). Không cần tạo file riêng cho quy tắc này — viết trực tiếp vào từng DTO cần validate password, hoặc (khuyến nghị) tách thành 1 custom decorator dùng chung để không lặp code.

> 📘 **Khái niệm — vì sao nên tách thành decorator dùng chung thay vì copy-paste regex 2 lần?** `RegisterDto` và `ResetPasswordDto` đều cần đúng 1 rule password. Nếu copy `@Matches(regex)` vào 2 file, sau này đổi policy (vd tăng độ dài tối thiểu) phải nhớ sửa cả 2 chỗ — dễ sót. Gom vào 1 decorator dùng lại (`@IsStrongPassword()`) chỉ cần sửa 1 nơi.

Tạo file `src/auth/decorators/is-strong-password.decorator.ts`:

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

Dùng trong DTO thay vì lặp lại 2 decorator:

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

Nếu bạn đã lỡ viết trực tiếp `@MinLength(8)` + `@Matches(...)` vào `RegisterDto` ở `02-register.md`, quay lại thay bằng `@IsStrongPassword()` khi làm tới bước này — không bắt buộc làm ngay lập tức nếu `02-register.md` đã xong và chạy được, nhưng nên dọn lại trước khi làm `11-reset-password.md` để không copy-paste regex lần 2.

Thử password `abc12345` (thiếu hoa + ký tự đặc biệt) — phải bị từ chối (`400`). Thử `Abc@1234` — phải hợp lệ. Và cả `RegisterDto` lẫn `ResetPasswordDto` nên dùng chung 1 decorator `IsStrongPassword()`, không có regex trùng lặp ở 2 nơi khác nhau.

---

## Bước 6 — TokenService đầy đủ

Bước cuối cùng của phần setup: tổng quát hoá `TokenService` (bản tối thiểu đã viết ở `02-register.md`, chỉ có `createEmailVerificationToken`) thành service dùng chung cho **cả 3 loại token**: email verification, password reset, refresh token. File cần sửa: `src/auth/services/token.service.ts` (sửa lại, không tạo file mới).

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

⚠️ Tên model Prisma (`emailVerificationToken`, `passwordResetToken`, `refreshToken`) và field (`userId`, `tokenHash`, `expiresAt`, `verifiedAt`, `usedAt`) phải khớp đúng `prisma/schema.prisma` — đối chiếu trước khi paste. Nếu repo chưa có package `ms`, cài thêm (`npm install ms @types/ms`) hoặc tự viết hàm parse TTL đơn giản (`'15m'` → phút, `'7d'` → ngày) — miễn nhất quán trong toàn bộ `TokenService`.

Đoạn `createVerificationTokenInTx` viết tay trong `AuthService.register()` (ở `02-register.md`) là bản trùng lặp tạm thời — sau khi `TokenService` đã đầy đủ như trên, cân nhắc refactor `AuthService.register()` gọi qua `tokenService` với tham số `tx` nếu muốn dọn code (không bắt buộc cho MVP, ghi ở [00-overview.md § Known Gaps](./00-overview.md)).

Kiểm tra lại: `TokenService` không có method nào trả raw token ra ngoài trừ lúc tạo mới (để gửi email/set cookie); gọi `createEmailVerificationToken` hoặc `createPasswordResetToken` 2 lần liên tiếp cho cùng user thì chỉ còn 1 token loại đó hợp lệ trong DB (token cũ bị xoá trước khi tạo mới — quyết định #8); và `createRefreshToken` tạo đúng 1 record `refresh_tokens` với TTL đọc từ `ConfigService` (`REFRESH_TOKEN_TTL`), không hardcode số ngày ở đâu cả.

---

➡️ Tiếp theo: [02-register.md](./02-register.md)
