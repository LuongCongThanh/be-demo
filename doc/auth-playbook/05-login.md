# 05 — Login (`POST /auth/login`) + Access Token

> ⬅️ Trước khi làm file này: xong [04-resend-verification.md](./04-resend-verification.md).
> 📚 Tham chiếu chung (Decisions, Security Rules, Response DTO...): [00-overview.md](./00-overview.md).

**Goal:** Xác thực user, trả Access Token trong response body + set Refresh Token qua cookie (quyết định #17). Gộp chung với "Access Token" (STEP 11 gốc) vì sinh access token là 1 phần bắt buộc, không tách được khỏi login.

> Step này gộp nhiều việc (đăng ký `JwtModule`, DTO, `AuthUserResponseDto` dùng chung, logic service, set cookie) nên tách thành **5 step con** 10.1 → 10.5.

---

## STEP 10.1 — Đăng ký `JwtModule` trong `AuthModule` — 🔴 Chưa làm

**Goal:** Có `JwtService` sẵn sàng để inject vào `AuthService`, cấu hình secret + TTL qua `ConfigService` (không hardcode).

**Files:** `src/auth/auth.module.ts`

> 📘 **Khái niệm — `JwtModule.registerAsync()` là gì?** `@nestjs/jwt` cung cấp `JwtModule` — khi import vào `AuthModule`, Nest tự tạo và inject sẵn `JwtService` (có sẵn method `sign()`/`verify()`) cho mọi provider trong module. Dùng `registerAsync()` (thay vì `register()` tĩnh) vì secret/TTL phải đọc từ `ConfigService` — mà `ConfigService` chỉ có giá trị _sau khi_ Nest khởi tạo DI container, nên cần cấu hình "bất đồng bộ" qua factory function.

**Implementation:**

```ts
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
// ...import PrismaModule/MailModule nếu chưa global

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService],
})
export class AuthModule {}
```

> ⚠️ Nếu `AuthModule` hiện tại (từ [01-setup.md § STEP 4](./01-setup.md)) đã có `imports`/`providers` khác (vd `PrismaModule`, `MailModule`), giữ nguyên các dòng đó — chỉ thêm `JwtModule.registerAsync(...)` vào mảng `imports`.

**Acceptance Criteria:**

- [ ] `npm run build` không lỗi.
- [ ] Inject `JwtService` vào constructor `AuthService` không báo lỗi "no provider found".

---

## STEP 10.2 — LoginDto + Response DTOs — 🔴 Chưa làm

**Goal:** Định nghĩa input login và 2 response DTO dùng theo allow-list ở [00-overview.md § 6](./00-overview.md).

**Files:** `src/auth/dto/login.dto.ts`, `src/auth/dto/auth-user-response.dto.ts`, `src/auth/dto/login-response.dto.ts`

**CLI:**

```powershell
New-Item src/auth/dto/login.dto.ts -ItemType File   # PowerShell
New-Item src/auth/dto/auth-user-response.dto.ts -ItemType File
New-Item src/auth/dto/login-response.dto.ts -ItemType File
```

```bash
touch src/auth/dto/login.dto.ts src/auth/dto/auth-user-response.dto.ts src/auth/dto/login-response.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

```ts
// src/auth/dto/login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Abc@1234' })
  @IsString()
  password: string;
}
```

```ts
// src/auth/dto/auth-user-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  fullName: string | null;

  @ApiProperty({ type: [String] })
  roles: string[];

  @ApiProperty()
  emailVerified: boolean;
}
```

```ts
// src/auth/dto/login-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { AuthUserResponseDto } from './auth-user-response.dto';

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
  // KHÔNG có refreshToken — nằm trong cookie (quyết định #17)
}
```

> `AuthUserResponseDto` là DTO dùng chung — [08-me.md](./08-me.md) (`GET /auth/me`) tái sử dụng lại, không tạo trùng.

**Acceptance Criteria:**

- [ ] 3 file compile được.

---

## STEP 10.3 — AuthService: sinh access token — 🔴 Chưa làm

**Goal:** Hàm helper sinh JWT access token từ user + roles, payload đúng chuẩn.

**Files:** `src/auth/services/auth.service.ts` (thêm method private + constructor param mới)

**Implementation:**

> 📘 **Khái niệm — JWT payload là gì, vì sao không nhét `passwordHash` vào?** JWT (JSON Web Token) gồm 3 phần: header, payload, signature. Payload là dữ liệu **ai cũng đọc được** nếu có token trong tay (chỉ mã hoá base64, không encrypt) — chữ ký (signature) chỉ đảm bảo payload không bị _sửa_, không đảm bảo payload được _giữ bí mật_. Vì vậy tuyệt đối không nhét `passwordHash`, refresh token, hay dữ liệu nhạy cảm vào payload — chỉ nhét thứ cần thiết để nhận diện user (`sub`, `email`, `roles`).
>
> 📘 **Khái niệm — vì sao access token là "stateless"?** JWT tự chứa đủ thông tin để verify (không cần tra DB) — server chỉ cần verify chữ ký bằng secret là biết token hợp lệ hay không, không cần lưu session ở đâu. Ưu điểm: nhanh, không tốn DB. Nhược điểm: **không thể "xoá" 1 token đã phát hành** trước khi nó tự hết hạn — đây là lý do TTL access token phải ngắn (15 phút), xem [Known Gaps § Access-token revocation tức thời](./00-overview.md).

```ts
// src/auth/services/auth.service.ts (bổ sung vào constructor + thêm method)
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService, // ← thêm mới
  ) {}

  // ... register(), verifyEmail(), resendVerification() đã có

  /**
   * Sinh JWT access token. Payload chỉ chứa thông tin cần để nhận diện user
   * (sub = userId, email, roles) — KHÔNG nhét passwordHash/refresh token/dữ
   * liệu cá nhân không cần thiết (JWT payload không được mã hoá, ai cũng đọc
   * được nếu có token).
   */
  private signAccessToken(user: {
    id: string;
    email: string;
    roles: string[];
  }): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      roles: user.roles, // mảng string từ roles.name — KHÔNG hardcode enum (quyết định #6)
    });
  }
}
```

**Acceptance Criteria:**

- [ ] Decode access token (vd bằng https://jwt.io hoặc `jwtService.decode()`) thấy đúng `sub`, `email`, `roles`.
- [ ] Token hết hạn sau đúng TTL cấu hình (`JWT_ACCESS_TTL`) — test bằng cách set TTL rất ngắn (vd `'1s'`) trong test env và chờ hết hạn trước khi verify lại.

---

## STEP 10.4 — AuthService.login() — 🔴 Chưa làm

**Goal:** Orchestrate flow login: tìm user → check 2 trục trạng thái → verify password → sinh access token + refresh token.

**Files:** `src/auth/services/auth.service.ts` (thêm method mới)

**Implementation:**

> 📘 **Khái niệm — vì sao "sai email" và "sai password" phải trả cùng 1 lỗi 401?** Nếu trả lỗi khác nhau ("Email không tồn tại" vs "Sai password"), kẻ tấn công dò được **email nào đã đăng ký** bằng cách thử login với password bất kỳ và đọc message — lại là user enumeration (xem [04-resend-verification.md](./04-resend-verification.md)). Login luôn trả `UnauthorizedException` chung chung cho cả 2 case.
>
> 📘 **Khái niệm — vì sao check 2 trục (`status` và `emailVerifiedAt`) tách biệt?** Theo quyết định #15 ([00-overview.md](./00-overview.md)), đây là 2 khái niệm độc lập: ADMIN có thể `BLOCKED` 1 tài khoản bất kể đã verify email hay chưa, và 1 tài khoản `ACTIVE` vẫn có thể chưa verify email. Login cần **cả hai** đúng mới cho qua (quyết định #1) — nhưng thông báo lỗi không được lộ chi tiết kiểu "email không tồn tại" cho case bị chặn.

```ts
// src/auth/services/auth.service.ts (thêm vào class AuthService)
import { UnauthorizedException } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';

// ... trong class AuthService

async login(dto: LoginDto): Promise<{
  accessToken: string;
  rawRefreshToken: string;
  user: { id: string; email: string; fullName: string | null; roles: string[]; emailVerified: boolean };
}> {
  const user = await this.prisma.user.findUnique({
    where: { email: dto.email },
    include: { roles: { include: { role: true } } },
  });

  // Không tồn tại → lỗi generic, KHÔNG phân biệt với sai password.
  if (!user) {
    throw new UnauthorizedException('Email hoặc password không đúng');
  }

  const passwordValid = await this.passwordService.verify(
    user.passwordHash,
    dto.password,
  );
  if (!passwordValid) {
    throw new UnauthorizedException('Email hoặc password không đúng');
  }

  // Kiểm tra CẢ HAI trục (quyết định #15) — SAU khi đã xác nhận password
  // đúng, để không lộ thêm thông tin cho kẻ đoán sai password.
  if (user.status === 'BLOCKED') {
    throw new UnauthorizedException('Tài khoản đã bị khoá');
  }
  if (!user.emailVerifiedAt) {
    throw new UnauthorizedException('Email chưa được xác thực');
  }

  const roles = user.roles.map((ur) => ur.role.name);
  const accessToken = this.signAccessToken({
    id: user.id,
    email: user.email,
    roles,
  });
  const rawRefreshToken = await this.tokenService.createRefreshToken(user.id);

  return {
    accessToken,
    rawRefreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName ?? null,
      roles,
      emailVerified: true,
    },
  };
}
```

> ⚠️ Tên relation `roles: { include: { role: true } }` giả định schema dạng `User.roles -> UserRole -> Role` (bảng nối `user_roles`) — đối chiếu đúng tên relation/field thật trong `prisma/schema.prisma` (`fullName` cũng có thể không tồn tại nếu schema không có field này — bỏ dòng đó nếu vậy).
>
> Trả `rawRefreshToken` ra khỏi `AuthService.login()` (thay vì tự set cookie trong Service) vì **Service không nên biết về HTTP response/cookie** — đó là trách nhiệm của Controller (STEP 10.5). Giữ Service thuần business logic giúp unit test dễ hơn (không cần mock `Response`).

**Acceptance Criteria:**

- [ ] Login đúng email/password, `ACTIVE` + đã verify → trả `accessToken` + `rawRefreshToken` + `user`.
- [ ] Sai password / email không tồn tại → cùng 1 `UnauthorizedException` (401), message giống hệt nhau.
- [ ] Account `BLOCKED` → bị chặn, message khác với case sai password (nhưng vẫn không lộ kiểu "email này tồn tại").
- [ ] Email chưa verify → bị chặn.

---

## STEP 10.5 — AuthController.login() + set cookie — 🔴 Chưa làm

**Goal:** Expose HTTP endpoint, trả access token trong body, set refresh token qua cookie `HttpOnly`+`Secure`+`SameSite`.

**Files:** `src/auth/auth.controller.ts` (thêm route mới)

**Implementation:**

> 📘 **Khái niệm — `@Res({ passthrough: true })` là gì, vì sao cần?** Bình thường NestJS tự lo việc set status code + serialize object trả về thành JSON response — bạn chỉ cần `return` 1 object trong method Controller. Nhưng để **set cookie**, bạn cần truy cập trực tiếp đối tượng `Response` của Express (`response.cookie(...)`). Nếu inject `@Res() response: Response` mà không có `passthrough: true`, Nest coi như bạn **tự quản lý toàn bộ response** — `return` trong method sẽ bị bỏ qua, bạn phải tự gọi `response.json(...)`/`response.send(...)` mới trả được dữ liệu. Thêm `{ passthrough: true }` giữ nguyên cơ chế tự động của Nest (vẫn `return` object bình thường) — bạn chỉ dùng `response` để làm thêm việc phụ (set cookie) trước khi Nest tự serialize.

```ts
// src/auth/auth.controller.ts (thêm vào class AuthController)
import { Response } from 'express';
import { Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ms from 'ms'; // cùng package/cách parse TTL đã dùng ở TokenService (01-setup.md § STEP 7)
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService, // ← thêm mới
  ) {}

  // ... register(), verifyEmail(), resendVerification() đã có

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const { accessToken, rawRefreshToken, user } =
      await this.authService.login(dto);

    const cookieName = this.config.get<string>(
      'REFRESH_TOKEN_COOKIE_NAME',
      'refresh_token',
    );
    // ⚠️ path phải khớp ĐÚNG prefix route auth thực tế của app — nếu main.ts
    // có `app.setGlobalPrefix('api')`, route thật là `/api/auth/*` và path ở
    // đây PHẢI là '/api/auth', không phải '/auth' cứng nhắc. Kiểm tra main.ts
    // trước khi hardcode.
    response.cookie(cookieName, rawRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
      // Đọc TTL qua ConfigService, KHÔNG hardcode số ms — parse bằng `ms()`,
      // cùng cách đã dùng ở TokenService.createRefreshToken() (01-setup.md § STEP 7).
      maxAge: ms(this.config.get<string>('REFRESH_TOKEN_TTL', '7d')),
    });

    return { accessToken, user };
  }
}
```

**Acceptance Criteria (toàn bộ flow — verify sau khi xong 10.1→10.5):**

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

➡️ Tiếp theo: [06-refresh-token.md](./06-refresh-token.md)
