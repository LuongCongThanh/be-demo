# 02 — Register (`POST /auth/register`)

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [01-setup.md](./01-setup.md) — module đã scaffold, `PasswordService`/`TokenService` cơ bản đã có, package đã cài, env đã sẵn. Cần tra thuật ngữ nào đó (DTO, transaction, hash...) thì mở [GLOSSARY.md](./GLOSSARY.md); cần nhắc lại 1 quyết định thiết kế (vd vì sao register không tự động login) thì xem [00-overview.md](./00-overview.md).

Đây là endpoint đầu tiên bạn sẽ code trong toàn bộ flow Auth: tạo tài khoản CUSTOMER mới và gửi email xác thực, mà không bao giờ lưu password hay token ở dạng thô. Việc này gộp khá nhiều thứ — validate input, hash password, sinh token, ghi DB trong 1 transaction, gửi mail, rồi mới expose ra HTTP — nên bài này chia thành 6 bước nhỏ, làm xong bước nào build được bước đó rồi mới sang bước sau.

---

## Bước 1 — Tạo "form đăng ký" (RegisterDto)

Trước khi viết logic, bạn cần mô tả rõ ràng dữ liệu mà client phải gửi lên khi đăng ký: `email` và `password`. Trong NestJS, việc này làm qua 1 class gọi là DTO (Data Transfer Object).

Tạo file `src/auth/dto/register.dto.ts`:

```powershell
New-Item src/auth/dto/register.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/register.dto.ts   # Bash (Git Bash/WSL)
```

NestJS có sẵn `ValidationPipe` (thường bật global trong `main.ts`) tự động đọc decorator gắn trên DTO này để kiểm tra input — nếu sai, Nest tự trả `400 Bad Request` **trước khi** code bạn viết trong Controller/Service kịp chạy, không cần tự viết `if` kiểm tra tay. Viết class sau:

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

Chạy `npm run build` để chắc chắn file không lỗi cú pháp — bạn chưa gọi được route nào ở bước này cả, chỉ mới có "hình dạng" dữ liệu. Nếu muốn tin chắc validate hoạt động, thử tạo 1 instance với `password: 'abc'` ở đâu đó tạm thời và chạy qua `class-validator` — bạn sẽ thấy lỗi validate bật lên ngay; việc này để dành verify chính thức khi xong Bước 6.

---

## Bước 2 — Hash password (PasswordService)

Không bao giờ được lưu password thô vào DB. Bước này viết phần hash — biến password thành 1 chuỗi không thể đảo ngược lại, chỉ dùng để so sánh.

> 📘 **Khái niệm — vì sao dùng `argon2` thay vì `bcrypt` hay tự viết SHA-256?** Password không được hash bằng thuật toán hash "nhanh" thông thường (MD5, SHA-256) vì máy tính hiện đại thử được hàng tỷ hash/giây → brute-force dễ dàng. `argon2` (và `bcrypt`) là thuật toán **cố tình chậm và tốn RAM**, khiến brute-force tốn kém về thời gian/tiền bạc. `argon2` là thuật toán thắng cuộc thi Password Hashing Competition, được khuyến nghị hiện nay.

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

`argon2.hash()` tự sinh salt ngẫu nhiên và nhúng vào chuỗi hash trả về, nên bạn không cần tự quản lý salt riêng. Muốn chắc chắn nó hoạt động đúng, gọi thử `hash('Abc@1234')` 2 lần — bạn sẽ thấy 2 chuỗi hash khác nhau (vì salt ngẫu nhiên mỗi lần), nhưng cả 2 vẫn `verify()` đúng lại với `'Abc@1234'` ban đầu.

---

## Bước 3 — Sinh token xác thực email (TokenService)

Sau khi tạo user, bạn cần gửi cho họ 1 link xác thực email, và link đó phải chứa 1 token không ai đoán được. Bước này viết phần tối thiểu để sinh token đó — bản đầy đủ dùng chung cho cả reset-password/refresh sẽ hoàn thiện ở [01-setup.md § TokenService đầy đủ](./01-setup.md), ở đây chỉ cần đủ cho Register chạy được.

> 📘 **Khái niệm — vì sao token gửi qua email khác với token lưu trong DB?**
> Nếu lưu thẳng token gốc (raw token) vào DB, ai đọc được DB (backup leak, SQL injection...) sẽ dùng được token đó luôn — giống hệt như lưu raw password. Cách làm đúng: sinh token ngẫu nhiên (`rawToken`), gửi `rawToken` qua email cho user, nhưng **chỉ lưu `hash(rawToken)`** vào DB. Khi user click link chứa `rawToken`, server hash lại và so khớp với `tokenHash` trong DB — không cần lưu bản gốc mà vẫn xác minh được.

Mở `src/auth/services/token.service.ts` (đã scaffold rỗng ở `01-setup.md`) và viết:

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

⚠️ Trước khi paste, đối chiếu lại tên model/field Prisma (`emailVerificationToken`, `userId`, `tokenHash`, `expiresAt`, `verifiedAt`) với `prisma/schema.prisma` thật của bạn — tên có thể khác đôi chút. Method `createPasswordResetToken`, `hashRawToken` (dùng ở verify/refresh sau này) sẽ được thêm đầy đủ ở `01-setup.md`, chưa cần lo ở bước này. Kiểm tra nhanh: gọi `createEmailVerificationToken()` từ 1 chỗ test tạm — bạn sẽ thấy đúng 1 record mới xuất hiện trong bảng `email_verification_tokens`.

---

## Bước 4 — Gửi email xác thực (MailService)

`AuthService` sắp orchestrate flow register không nên tự biết cách gửi mail qua SMTP/SES/SendGrid nào — nó chỉ cần gọi `mailService.sendVerificationEmail(email, token)`. Tách riêng như vậy giúp sau này đổi provider gửi mail mà không đụng vào code auth (xem thêm [00-overview.md § Shared Services](./00-overview.md) về nguyên tắc không tạo interface/DI token thừa cho MVP).

Mở `src/mail/mail.service.ts` (đã scaffold rỗng ở `01-setup.md`):

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

Với MVP, gọi thẳng hàm này chỉ in ra log console — đủ để bạn thấy flow chạy đúng trong lúc dev, chưa cần cấu hình SMTP thật. Gọi thử `sendVerificationEmail('a@b.com', 'xyz')` để chắc nó in log đúng và không throw lỗi gì.

---

## Bước 5 — Ghép mọi thứ lại trong AuthService.register()

Đây là bước "trái tim" của cả flow — nơi bạn điều phối (orchestrate) 4 bước trên theo đúng thứ tự: kiểm tra email chưa tồn tại → hash password → ghi User + role + token trong 1 transaction → gửi mail sau khi transaction đã commit xong.

> 📘 **Khái niệm — DB transaction là gì, vì sao cần?** Một transaction gom nhiều thao tác ghi DB (tạo user, gán role, tạo token) thành **1 khối tất-cả-hoặc-không-gì-cả**: nếu bước giữa chừng lỗi (vd gán role fail), toàn bộ được rollback — không để lại user "mồ côi" không có role. Prisma cung cấp `prisma.$transaction(async (tx) => {...})`, bên trong dùng `tx.<model>` thay vì `prisma.<model>` để mọi query nằm trong cùng 1 transaction.
>
> 📘 **Khái niệm — vì sao gửi email PHẢI nằm ngoài transaction?** Gọi email (network call ra ngoài) có thể chậm hoặc treo. Nếu đặt trong transaction, DB phải giữ lock/connection chờ suốt thời gian đó — tốn tài nguyên và tăng nguy cơ deadlock. Quy tắc: transaction chỉ chứa thao tác DB, side-effect ngoài (email, gọi API khác...) luôn thực hiện **sau khi transaction đã commit**. Xem thêm [00-overview.md § Shared Services — Rule: Transaction không bọc external call](./00-overview.md).

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
      // nếu có lỗi — nhưng TokenService ở Bước 3 tự inject PrismaService
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

Đoạn `createVerificationTokenInTx` hơi vòng vèo — lý do là `TokenService` ở Bước 3 tự inject `PrismaService` riêng nên không tham gia chung transaction được với `register()` ở đây. Đây là giới hạn đã biết của bản MVP tối thiểu, chấp nhận trùng lặp code nhỏ để giữ transaction đúng; dọn lại (refactor `TokenService` nhận `tx`) là việc có thể làm sau khi hoàn thiện `TokenService` ở `01-setup.md`, không bắt buộc ngay.

Thử gọi `authService.register({ email, password })` với 1 email mới — bạn sẽ thấy đúng 1 User được tạo với role CUSTOMER và đúng 1 EmailVerificationToken đi kèm, `passwordHash` không phải là chuỗi plain text bạn gõ vào. Gọi lại lần 2 với cùng email đó sẽ ném ra `ConflictException` và không có user thứ 2 nào được tạo thêm.

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

`@HttpCode(HttpStatus.CREATED)` đặt status `201` — mặc định `@Post()` của Nest trả `200` nếu không khai báo rõ.

Đến đây bạn đã có 1 endpoint hoạt động đầy đủ. Gọi thử qua Postman/curl để tự xác nhận: gửi request hợp lệ phải nhận `201` cùng `{ id, email }`, không có field nào khác lộ ra; gửi lại đúng email đó lần nữa phải nhận `409`; gửi password yếu (vd thiếu ký tự đặc biệt) phải nhận `400`. Cũng nên thử trường hợp `MailService` giả lập throw lỗi (tạm sửa hàm để nó throw) — user vẫn phải được tạo bình thường, chỉ có dòng log lỗi xuất hiện, không có gì crash.

---

➡️ Tiếp theo: [03-verify-email.md](./03-verify-email.md)
