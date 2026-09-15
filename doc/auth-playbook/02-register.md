# 02 — Register (`POST /auth/register`)

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [01-setup.md](./01-setup.md): module đã scaffold, `PasswordService`/`TokenService` cơ bản đã có, package đã cài, env đã sẵn. Cần tra thuật ngữ nào đó (DTO, transaction, hash...) thì mở [GLOSSARY.md](./GLOSSARY.md); cần nhắc lại 1 quyết định thiết kế (vd vì sao register không tự động login) thì xem [00-overview.md](./00-overview.md).

Đây là endpoint đầu tiên bạn sẽ code trong toàn bộ flow Auth: tạo tài khoản CUSTOMER mới và gửi email xác thực, mà không bao giờ lưu password hay token ở dạng thô. Việc này gộp khá nhiều thứ: validate input, hash password, sinh token, ghi DB trong 1 transaction, gửi mail, rồi mới expose ra HTTP. Vì vậy bài này chia thành 6 bước nhỏ, làm xong bước nào build được bước đó rồi mới sang bước sau.

---

## Bước 1 — Tạo "form đăng ký" (RegisterDto)

Trước khi viết logic, bạn cần mô tả rõ ràng dữ liệu mà client phải gửi lên khi đăng ký: `email`, `password`, `fullName` và `phone`. Trong NestJS, việc này làm qua 1 class gọi là DTO (Data Transfer Object).

Tạo file `src/auth/dto/register.dto.ts`:

```powershell
New-Item src/auth/dto/register.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/register.dto.ts   # Bash (Git Bash/WSL)
```

NestJS có sẵn `ValidationPipe` (thường bật global trong `main.ts`) tự động đọc decorator gắn trên DTO này để kiểm tra input. Nếu sai, Nest tự trả `400 Bad Request` trước khi code bạn viết trong Controller/Service kịp chạy, không cần tự viết `if` kiểm tra tay. Viết class sau:

```ts
// src/auth/dto/register.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { IsStrongPassword } from '../decorators/is-strong-password.decorator.js';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Abc@1234' })
  @IsString()
  // Áp dụng luôn password policy (quyết định #9). Decorator này bọc đúng
  // pattern/test case đã mô tả ở 01-setup.md § Password policy, không lặp
  // lại @Matches thủ công ở từng DTO.
  @IsStrongPassword()
  password!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  fullName!: string;

  @ApiProperty({ example: '0912345678' })
  @IsString()
  @Matches(/^[0-9+\-\s]{8,15}$/, { message: 'phone must be a valid phone number' })
  phone!: string;
}
```

`fullName`/`phone` là 2 field **bắt buộc**, không phải optional: nếu thiếu hoặc rỗng, `ValidationPipe` chặn ngay ở tầng DTO với `400 Bad Request`, request không chạm tới `AuthController`/`AuthService`. `fullName` chỉ cần `@IsNotEmpty()` (không trim khoảng trắng thừa hay giới hạn ký tự đặc biệt ở MVP này); `phone` dùng `@Matches()` với pattern chấp nhận số, `+`, `-`, khoảng trắng, dài 8–15 ký tự — đủ lỏng để nhận cả số nội địa và số có mã quốc gia, không cố phân biệt định dạng theo từng nước.

Chạy `npm run build` để chắc chắn file không lỗi cú pháp. Bạn chưa gọi được route nào ở bước này cả, chỉ mới có "hình dạng" dữ liệu. Nếu muốn tin chắc validate hoạt động, thử tạo 1 instance thiếu `fullName` hoặc `phone` sai định dạng và chạy qua `class-validator`: bạn sẽ thấy lỗi validate bật lên ngay. Việc này để dành verify chính thức khi xong Bước 6.

---

## Bước 2 — Hash password (PasswordService)

Không bao giờ được lưu password thô vào DB. Bước này viết phần hash: biến password thành 1 chuỗi không thể đảo ngược lại, chỉ dùng để so sánh.

> 📘 **Khái niệm: vì sao dùng `argon2` thay vì `bcrypt` hay tự viết SHA-256?** Password không được hash bằng thuật toán hash "nhanh" thông thường (MD5, SHA-256) vì máy tính hiện đại thử được hàng tỷ hash/giây → brute-force dễ dàng. `argon2` (và `bcrypt`) là thuật toán cố tình chậm và tốn RAM, khiến brute-force tốn kém về thời gian/tiền bạc. `argon2` là thuật toán thắng cuộc thi Password Hashing Competition, được khuyến nghị hiện nay.

Mở `src/auth/services/password.service.ts` (đã scaffold rỗng ở `01-setup.md`) và viết:

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

`argon2.hash()` tự sinh salt ngẫu nhiên và nhúng vào chuỗi hash trả về, nên bạn không cần tự quản lý salt riêng. Muốn chắc chắn nó hoạt động đúng, gọi thử `hash('Abc@1234')` 2 lần: bạn sẽ thấy 2 chuỗi hash khác nhau (vì salt ngẫu nhiên mỗi lần), nhưng cả 2 vẫn `verify()` đúng lại với `'Abc@1234'` ban đầu.

---

## Bước 3 — Sinh mã xác thực email (TokenService)

Sau khi tạo user, bạn cần gửi cho họ 1 mã xác thực email (OTP 6 số) không ai đoán được trong thời gian ngắn. Bước này viết phần tối thiểu để sinh mã đó. Bản đầy đủ dùng chung cho cả reset-password/refresh sẽ hoàn thiện ở [01-setup.md § TokenService đầy đủ](./01-setup.md), ở đây chỉ cần đủ cho Register chạy được.

> 📘 **Khái niệm: vì sao mã gửi qua email khác với giá trị lưu trong DB?**
> Nếu lưu thẳng mã gốc (raw code) vào DB, ai đọc được DB (backup leak, SQL injection...) sẽ dùng được mã đó luôn, giống hệt như lưu raw password. Cách làm đúng: sinh mã ngẫu nhiên (`rawCode`), gửi `rawCode` qua email cho user, nhưng chỉ lưu `hash(rawCode)` vào DB. Khi user nhập mã vào form verify, server hash lại và so khớp với `tokenHash` trong DB, không cần lưu bản gốc mà vẫn xác minh được.
>
> 📘 **Khái niệm: vì sao dùng mã 6 số thay vì chuỗi ngẫu nhiên dài (raw token)?** Mã 6 số dễ đọc/gõ tay hơn (user nhận mail, tự nhập vào form), phù hợp UX kiểu OTP. Đánh đổi: không gian chỉ còn 1 triệu khả năng (so với 2^256 của token 32-byte hex), nên phải bù lại bằng thời hạn ngắn (10 phút, so với 24h của token cũ) và bắt buộc endpoint verify nhận kèm `email` để giới hạn phạm vi so khớp (xem `03-verify-email.md`).

Mở `src/auth/services/token.service.ts` (đã scaffold rỗng ở `01-setup.md`) và viết:

```ts
// src/auth/services/token.service.ts
import { randomInt, createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // chỉnh lại path đúng với vị trí PrismaService trong repo

@Injectable()
export class TokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sinh mã 6 số ngẫu nhiên (raw) + hash SHA-256 của nó. */
  private generate(): { rawCode: string; tokenHash: string } {
    const rawCode = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const tokenHash = createHash('sha256').update(rawCode).digest('hex');
    return { rawCode, tokenHash };
  }

  /**
   * Tạo Email Verification Token mới cho user — xoá token cũ chưa dùng trước
   * (quyết định #8), trả về rawCode (mã 6 số) để gửi qua email (không lưu
   * raw vào DB).
   */
  async createEmailVerificationToken(userId: string): Promise<string> {
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId, verifiedAt: null },
    });

    const { rawCode, tokenHash } = this.generate();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút — ngắn vì không gian mã chỉ 1 triệu khả năng

    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return rawCode;
  }
}
```

⚠️ Trước khi paste, đối chiếu lại tên model/field Prisma (`emailVerificationToken`, `userId`, `tokenHash`, `expiresAt`, `verifiedAt`) với `prisma/schema.prisma` thật của bạn: tên có thể khác đôi chút. Method `createPasswordResetToken`, `hashRawToken` (dùng ở verify/refresh sau này) sẽ được thêm đầy đủ ở `01-setup.md`, chưa cần lo ở bước này. Kiểm tra nhanh: gọi `createEmailVerificationToken()` từ 1 chỗ test tạm. Bạn sẽ thấy đúng 1 record mới xuất hiện trong bảng `email_verification_tokens`.

---

## Bước 4 — Gửi email xác thực (MailService)

`AuthService` sắp orchestrate flow register không nên tự biết cách gửi mail qua SMTP/SES/SendGrid nào, nó chỉ cần gọi `mailService.sendVerificationEmail(email, token)`. Tách riêng như vậy giúp sau này đổi provider gửi mail mà không đụng vào code auth (xem thêm [00-overview.md § Shared Services](./00-overview.md) về nguyên tắc không tạo interface/DI token thừa cho MVP).

Mở `src/mail/mail.service.ts` (đã scaffold rỗng ở `01-setup.md`):

```ts
// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<string>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    this.from = this.config.get<string>('SMTP_FROM', 'no-reply@example.com');

    // Chỉ tạo transporter thật khi đủ 4 biến SMTP_*. Thiếu 1 trong 4 → coi
    // như "chưa cấu hình", rơi về nhánh log-only bên dưới. Nhờ vậy local
    // dev/CI không cần credential thật vẫn chạy được, không throw lỗi khi
    // thiếu env.
    this.transporter =
      host && port && user && pass
        ? nodemailer.createTransport({
            host,
            port: Number(port),
            secure: Number(port) === 465, // 465 = implicit TLS; 587/25 dùng STARTTLS
            auth: { user, pass },
          })
        : null;

    if (!this.transporter) {
      this.logger.warn(
        'SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS not fully set — emails will only be logged, not actually sent. See .env.example.',
      );
    }
  }

  async sendVerificationEmail(to: string, code: string): Promise<void> {
    if (!this.transporter) {
      // Dev/CI fallback: chưa cấu hình SMTP, không thử gửi thật.
      // KHÔNG log code (quy tắc bảo mật, 00-overview.md §5) — đó là 1
      // secret còn dùng được để verify. Chỉ log việc "sẽ gửi" là đủ.
      this.logger.log(`[DEV] Would send verification email to ${to}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Verify your email address',
      html: `<p>Your email verification code is:</p><p style="font-size:24px;font-weight:bold">${code}</p><p>This code expires in 10 minutes.</p>`,
      text: `Your email verification code is: ${code} (expires in 10 minutes)`,
    });
  }
}
```

**Vì sao code như vậy:**

- Gọi provider SMTP qua `nodemailer` (package thật, không tự viết lại SMTP protocol). `ConfigService` (NestJS) đọc `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` từ `.env` — 5 biến này cần thêm vào `.env.example`, xem mẫu:

  ```env
  # SMTP for transactional email (verify-email code, forgot-password links).
  # Leave all 4 unset to keep emails logged only (no real send) — that's the
  # default, safe for local dev/CI without real credentials.
  # For local testing with a real inbox-like view (nothing gets delivered to
  # a real recipient), https://mailtrap.io gives free sandbox SMTP creds.
  SMTP_HOST=
  SMTP_PORT=
  SMTP_USER=
  SMTP_PASS=
  SMTP_FROM=no-reply@example.com
  ```

- **Fallback log-only khi thiếu SMTP\_\*:** nếu 1 trong 4 biến `SMTP_HOST/PORT/USER/PASS` trống, `transporter` là `null` và hàm chỉ log `[DEV] Would send verification email to ...`, không throw lỗi. Local dev/CI chạy được ngay không cần tài khoản SMTP thật; chỉ khi deploy thật (hoặc muốn test bằng inbox giả như Mailtrap) mới cần điền đủ 4 biến.
- **`secure: Number(port) === 465`**: cổng `465` dùng TLS ngay từ đầu kết nối (implicit TLS); cổng `587`/`25` dùng STARTTLS (bắt đầu plain, nâng cấp lên TLS sau) nên `secure` phải là `false`. Đặt sai sẽ khiến kết nối SMTP thất bại hoặc bị provider từ chối.
- **Mã xác thực gửi thẳng trong nội dung mail** (không phải link): đây chính là `code` (raw 6 số) sinh ra ở `TokenService` (Bước 3), gửi thẳng cho user qua email, KHÔNG lưu vào DB (chỉ `tokenHash` được lưu — xem lại nguyên tắc ở Bước 3). User tự đọc mã từ mail, nhập vào form của frontend, frontend gọi `POST /auth/verify-email` với `{ email, code }` — chi tiết luồng verify ở [03-verify-email.md](./03-verify-email.md).
- Không log `code` ở nhánh fallback: log là nơi dễ bị đọc lại (file log, log aggregator...), log ra mã thô coi như phát tán chính secret mà toàn bộ cơ chế "chỉ lưu hash" đang cố bảo vệ.

Gọi thử `sendVerificationEmail('a@b.com', '123456')` khi chưa set `SMTP_*`: bạn sẽ thấy dòng log `[DEV] Would send verification email to a@b.com`, không throw lỗi, không thấy `123456` (raw code) xuất hiện ở đâu trong log. Muốn thấy email thật được gửi, tạo tài khoản sandbox ở [mailtrap.io](https://mailtrap.io), điền 4 biến `SMTP_*` vào `.env`, gọi lại — email sẽ xuất hiện trong inbox sandbox của Mailtrap (không gửi tới địa chỉ thật).

---

## Bước 5 — Ghép mọi thứ lại trong AuthService.register()

Đây là bước "trái tim" của cả flow: nơi bạn điều phối (orchestrate) 4 bước trên theo đúng thứ tự. Kiểm tra email chưa tồn tại, hash password, ghi User + role + token trong 1 transaction, rồi gửi mail sau khi transaction đã commit xong.

> 📘 **Khái niệm: DB transaction là gì, vì sao cần?** Một transaction gom nhiều thao tác ghi DB (tạo user, gán role, tạo token) thành 1 khối tất-cả-hoặc-không-gì-cả: nếu bước giữa chừng lỗi (vd gán role fail), toàn bộ được rollback, không để lại user "mồ côi" không có role. Prisma cung cấp `prisma.$transaction(async (tx) => {...})`, bên trong dùng `tx.<model>` thay vì `prisma.<model>` để mọi query nằm trong cùng 1 transaction.
>
> 📘 **Khái niệm: vì sao gửi email PHẢI nằm ngoài transaction?** Gọi email (network call ra ngoài) có thể chậm hoặc treo. Nếu đặt trong transaction, DB phải giữ lock/connection chờ suốt thời gian đó, tốn tài nguyên và tăng nguy cơ deadlock. Quy tắc: transaction chỉ chứa thao tác DB, side-effect ngoài (email, gọi API khác...) luôn thực hiện sau khi transaction đã commit. Xem thêm [00-overview.md § Shared Services § Rule: Transaction không bọc external call](./00-overview.md).

Mở `src/auth/services/auth.service.ts` (đã scaffold rỗng ở `01-setup.md`) và viết:

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
      throw new ConflictException('Email already in use');
    }

    // 2. Hash password TRƯỚC transaction — hash không phụ thuộc DB, không cần
    //    nằm trong transaction (và argon2 khá tốn CPU, không nên giữ transaction
    //    mở lâu hơn cần thiết).
    const passwordHash = await this.passwordService.hash(dto.password);

    // 3. Transaction: tạo user + gán role CUSTOMER + tạo verification token.
    //    Dùng `tx` (không phải `this.prisma`) bên trong để cùng 1 transaction.
    const { user, rawCode } = await this.prisma.$transaction(async (tx) => {
      const customerRole = await tx.role.findUniqueOrThrow({
        where: { name: 'CUSTOMER' },
      });

      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName, // bắt buộc, validate ở RegisterDto Bước 1
          phone: dto.phone, // bắt buộc, validate ở RegisterDto Bước 1
          status: 'ACTIVE',
          userRoles: { create: [{ roleId: customerRole.id }] },
        },
      });

      // TokenService cũng cần chạy trong transaction này để rollback đồng bộ
      // nếu có lỗi — nhưng TokenService ở Bước 3 tự inject PrismaService
      // riêng (không nhận `tx`). Cách đơn giản cho MVP: gọi thẳng
      // `tx.emailVerificationToken.create(...)` ở đây thay vì gọi qua
      // TokenService khi cần chung transaction — xem ghi chú bên dưới.
      const code = await this.createVerificationTokenInTx(tx, createdUser.id);

      return { user: createdUser, rawCode: code };
    });

    // 4. Gửi mail SAU khi transaction đã commit — không rollback nếu fail.
    try {
      await this.mailService.sendVerificationEmail(user.email, rawCode);
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${user.email}`, err as Error);
      // Không throw lại — user vẫn được tạo, có thể resend-verification (03-verify-email.md/04-resend-verification.md).
    }

    // 5. Response qua DTO allow-list — không trả passwordHash/token.
    return { id: user.id, email: user.email };
  }

  /**
   * Helper tạo verification token TRONG transaction hiện tại (`tx`), tách khỏi
   * TokenService.createEmailVerificationToken() (Bước 3) vì hàm đó tự mở
   * PrismaService riêng, không tham gia được transaction của Prisma Client
   * gốc. Đây là cách đơn giản cho MVP; nếu muốn tái sử dụng logic generate+hash
   * token của TokenService bên trong transaction, refactor TokenService để
   * nhận `tx` qua tham số thay vì tự inject `this.prisma` — cân nhắc khi làm
   * TokenService đầy đủ ở `01-setup.md` (không bắt buộc phải sửa ngay ở bước này).
   */
  private async createVerificationTokenInTx(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
  ): Promise<string> {
    const { randomInt, createHash } = await import('crypto');
    const rawCode = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const tokenHash = createHash('sha256').update(rawCode).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await tx.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return rawCode;
  }
}
```

Đoạn `createVerificationTokenInTx` hơi vòng vèo. Lý do là `TokenService` ở Bước 3 tự inject `PrismaService` riêng nên không tham gia chung transaction được với `register()` ở đây. Đây là giới hạn đã biết của bản MVP tối thiểu, chấp nhận trùng lặp code nhỏ để giữ transaction đúng; dọn lại (refactor `TokenService` nhận `tx`) là việc có thể làm sau khi hoàn thiện `TokenService` ở `01-setup.md`, không bắt buộc ngay.

⚠️ `fullName`/`phone` là cột **bắt buộc** (`NOT NULL`) trên model `User` trong `prisma/schema.prisma` (không có `?` sau kiểu), nên cần migration Prisma tương ứng nếu bảng `users` đã có data cũ chưa có 2 cột này (`npx prisma migrate dev`). Vì cả 2 field đã validate bắt buộc ở `RegisterDto` (Bước 1), `dto.fullName`/`dto.phone` ở đây luôn có giá trị hợp lệ, không cần check `null`/`undefined` lại lần nữa trong service.

Thử gọi `authService.register({ email, password, fullName, phone })` với 1 email mới: bạn sẽ thấy đúng 1 User được tạo với role CUSTOMER, đủ `fullName`/`phone` và đúng 1 EmailVerificationToken đi kèm, `passwordHash` không phải là chuỗi plain text bạn gõ vào. Gọi lại lần 2 với cùng email đó sẽ ném ra `ConflictException` và không có user thứ 2 nào được tạo thêm.

---

## Bước 6 — Mở endpoint HTTP (AuthController)

Bước cuối: expose flow trên ra thành route thật `POST /auth/register`, trả đúng dữ liệu cho phép (không có `passwordHash`, không tự động đăng nhập).

Tạo file `src/auth/dto/register-response.dto.ts`:

```powershell
New-Item src/auth/dto/register-response.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/register-response.dto.ts   # Bash (Git Bash/WSL)
```

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

Rồi nối vào `AuthController`:

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

`@HttpCode(HttpStatus.CREATED)` đặt status `201`: mặc định `@Post()` của Nest trả `200` nếu không khai báo rõ.

Đến đây bạn đã có 1 endpoint hoạt động đầy đủ. Body hợp lệ giờ cần đủ 4 field:

```json
{
  "email": "user@example.com",
  "password": "Abc@1234",
  "fullName": "John Doe",
  "phone": "0912345678"
}
```

Gọi thử qua Postman/curl để tự xác nhận: gửi request hợp lệ phải nhận `201` cùng `{ id, email }`, không có field nào khác lộ ra (không có `fullName`/`phone`/`passwordHash`); gửi lại đúng email đó lần nữa phải nhận `409`; gửi password yếu (vd thiếu ký tự đặc biệt) phải nhận `400`; thiếu `fullName` hoặc gửi `phone` sai định dạng (vd `"abc"`) cũng phải nhận `400`. Cũng nên thử trường hợp `MailService` không có `SMTP_*` (mặc định lúc dev): user vẫn phải được tạo bình thường, chỉ có dòng log `[DEV] Would send verification email to ...` xuất hiện, không có gì crash.

---

➡️ Tiếp theo: [03-verify-email.md](./03-verify-email.md)
