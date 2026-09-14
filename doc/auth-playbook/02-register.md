# 02 — Register (`POST /auth/register`)

> ⬅️ Trước khi làm file này: xong [01-setup.md](./01-setup.md) (module đã scaffold, `PasswordService`/`TokenService` cơ bản, package đã cài, env đã có).
> 📚 Tham chiếu chung (Decisions, Security Rules, Response DTO...): [00-overview.md](./00-overview.md).

**Goal:** Tạo user CUSTOMER mới và gửi email verification, không lưu raw password/token.

> STEP này gộp nhiều việc (DTO, hash password, sinh token, transaction, gửi mail, controller) nên được **tách thành 6 step con** — làm tuần tự 5.1 → 5.6, mỗi step con build/compile được trước khi sang step tiếp theo.

---

## STEP 5.1 — RegisterDto — 🔴 Chưa làm

**Goal:** Định nghĩa + validate dữ liệu client gửi lên khi đăng ký.

**Files:** `src/auth/dto/register.dto.ts`

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
  // và test case ở 01-setup.md § Password policy, ở đây dùng luôn để
  // RegisterDto hoạt động đúng ngay.
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'Password phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt',
  })
  password: string;
}
```

**Acceptance Criteria:**

- [ ] File compile được (`npm run build` không lỗi), chưa cần route nào gọi tới.
- [ ] Import `RegisterDto` ở một file test tạm thời, tạo instance với `password: 'abc'` → thấy lỗi validate khi chạy qua `class-validator` (có thể để dành verify khi làm xong STEP 5.6, không bắt buộc viết test riêng ở đây).

---

## STEP 5.2 — PasswordService (hash) — 🔴 Chưa làm

**Goal:** Hash password bằng argon2, không tự viết thuật toán hash tay.

**Files:** `src/auth/services/password.service.ts` (đã scaffold rỗng ở 01-setup.md)

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

## STEP 5.3 — TokenService (tối thiểu cho email verification) — 🔴 Chưa làm

**Goal:** Sinh token ngẫu nhiên + hash để lưu DB, đủ dùng cho Register. Bản đầy đủ (dùng chung cho reset-password/refresh) làm ở [01-setup.md § TokenService đầy đủ](./01-setup.md) — ở đây chỉ implement phần tối thiểu để STEP này chạy được.

**Files:** `src/auth/services/token.service.ts` (đã scaffold rỗng ở 01-setup.md)

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

> ⚠️ Tên model/field Prisma (`emailVerificationToken`, `userId`, `tokenHash`, `expiresAt`, `verifiedAt`) phải khớp `prisma/schema.prisma` — đối chiếu lại trước khi paste. Method `createPasswordResetToken`, `hashRawToken` (dùng ở verify/refresh) sẽ được thêm đầy đủ ở [01-setup.md](./01-setup.md).

**Acceptance Criteria:**

- [ ] File compile được, `createEmailVerificationToken()` gọi được từ 1 test tạm hoặc từ STEP 5.5 và tạo đúng 1 record trong bảng `email_verification_tokens`.

---

## STEP 5.4 — MailService (gửi email verification) — 🔴 Chưa làm

**Goal:** Gửi email chứa link verification, đứng ngoài `auth` module.

**Files:** `src/mail/mail.service.ts` (đã scaffold rỗng ở 01-setup.md)

**Implementation:**

> 📘 **Khái niệm — vì sao `MailService` là module riêng, không nằm trong `auth`?** `AuthService` không cần biết chi tiết gửi mail qua SMTP hay SES/SendGrid — nó chỉ cần gọi `mailService.sendVerificationEmail(email, token)`. Tách riêng giúp sau này đổi provider gửi mail mà không đụng vào code auth. Xem thêm [00-overview.md § Shared Services](./00-overview.md) về nguyên tắc không tạo interface/DI token thừa cho MVP.

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
    this.logger.log(
      `[DEV] Gửi verification email tới ${to}: token=${rawToken}`,
    );
  }

  async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
    this.logger.log(
      `[DEV] Gửi reset-password email tới ${to}: token=${rawToken}`,
    );
  }
}
```

**Acceptance Criteria:**

- [ ] File compile được. Gọi `sendVerificationEmail('a@b.com', 'xyz')` in ra log đúng nội dung, không throw lỗi.

---

## STEP 5.5 — AuthService.register() — 🔴 Chưa làm

**Goal:** Orchestrate toàn bộ flow register: validate email chưa tồn tại → hash password → transaction tạo user+role+token → gửi mail sau khi commit.

**Files:** `src/auth/services/auth.service.ts` (đã scaffold rỗng ở 01-setup.md)

**Implementation:**

> 📘 **Khái niệm — DB transaction là gì, vì sao cần?** Một transaction gom nhiều thao tác ghi DB (tạo user, gán role, tạo token) thành **1 khối tất-cả-hoặc-không-gì-cả**: nếu bước giữa chừng lỗi (vd gán role fail), toàn bộ được rollback — không để lại user "mồ côi" không có role. Prisma cung cấp `prisma.$transaction(async (tx) => {...})`, bên trong dùng `tx.<model>` thay vì `prisma.<model>` để mọi query nằm trong cùng 1 transaction.
>
> 📘 **Khái niệm — vì sao gửi email PHẢI nằm ngoài transaction?** Gọi email (network call ra ngoài) có thể chậm hoặc treo. Nếu đặt trong transaction, DB phải giữ lock/connection chờ suốt thời gian đó — tốn tài nguyên và tăng nguy cơ deadlock. Quy tắc: transaction chỉ chứa thao tác DB, side-effect ngoài (email, gọi API khác...) luôn thực hiện **sau khi transaction đã commit**. Xem thêm [00-overview.md § Shared Services — Rule: Transaction không bọc external call](./00-overview.md).

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
          roles: { create: [{ roleId: customerRole.id }] },
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
      this.logger.error(
        `Gửi verification email thất bại cho ${user.email}`,
        err as Error,
      );
      // Không throw lại — user vẫn được tạo, có thể resend-verification (03-verify-email.md/04-resend-verification.md).
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
   * TokenService đầy đủ ở 01-setup.md (không bắt buộc phải sửa ngay ở step này).
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

> ⚠️ Đoạn `createVerificationTokenInTx` là do STEP 5.3 (`TokenService`) tự inject `PrismaService` riêng nên không tham gia chung transaction được với `AuthService.register()`. Đây là **giới hạn đã biết của bản MVP tối thiểu ở STEP 5.3** — chấp nhận trùng lặp code nhỏ để giữ transaction đúng, dọn lại (refactor `TokenService` nhận `tx`) khi làm TokenService đầy đủ ở [01-setup.md](./01-setup.md) nếu muốn.

**Acceptance Criteria:**

- [ ] Gọi `authService.register({ email, password })` với email mới → tạo đúng 1 User có role CUSTOMER + đúng 1 EmailVerificationToken, `passwordHash` không phải plain text.
- [ ] Gọi lại với cùng email → ném `ConflictException` (409), không tạo thêm user.

---

## STEP 5.6 — AuthController (`POST /auth/register`) — 🔴 Chưa làm

**Goal:** Expose HTTP endpoint, trả đúng `RegisterResponseDto`.

**Files:** `src/auth/auth.controller.ts`, `src/auth/dto/register-response.dto.ts` (mới)

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

> `@HttpCode(HttpStatus.CREATED)` set status `201` — mặc định `@Post()` của Nest trả `200` nếu không khai báo rõ.

**Acceptance Criteria (toàn bộ flow — verify sau khi xong 5.1→5.6):**

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

➡️ Tiếp theo: [03-verify-email.md](./03-verify-email.md)
