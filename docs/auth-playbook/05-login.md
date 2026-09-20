# 05: Login (`POST /auth/login`) + Access Token

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [04-resend-verification.md](./04-resend-verification.md). Cần tra thuật ngữ thì mở [GLOSSARY.md](./GLOSSARY.md); cần nhắc lại quyết định thiết kế thì xem [00-overview.md](./00-overview.md).

Đây là endpoint xác thực user, trả Access Token trong response body + set Refresh Token qua cookie (quyết định #17). Phần sinh access token (đáng lẽ là 1 mục riêng trong bản playbook gốc) được gộp thẳng vào đây vì nó là 1 phần bắt buộc của login, không tách rời được. File này khá dài: đăng ký `JwtModule`, viết DTO, sinh access token, viết logic login, rồi set cookie ở Controller. Vì vậy chia thành 5 bước.

---

## Bước 1: Đăng ký JwtModule trong AuthModule

Trước khi sinh được access token, `AuthService` cần có `JwtService` để inject vào.

> 📘 **Khái niệm: `JwtModule.registerAsync()` là gì?** `@nestjs/jwt` cung cấp `JwtModule`. Khi import vào `AuthModule`, Nest tự tạo và inject sẵn `JwtService` (có sẵn method `sign()`/`verify()`) cho mọi provider trong module. Dùng `registerAsync()` (thay vì `register()` tĩnh) vì secret/TTL phải đọc từ `ConfigService`; mà `ConfigService` chỉ có giá trị _sau khi_ Nest khởi tạo DI container, nên cần cấu hình "bất đồng bộ" qua factory function.

Mở `src/auth/auth.module.ts` và thêm `JwtModule.registerAsync(...)`, đọc secret + TTL qua `ConfigService` chứ không hardcode:

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

⚠️ Nếu `AuthModule` hiện tại (từ 01-setup.md, Bước scaffold module) đã có `imports`/`providers` khác (vd `PrismaModule`, `MailModule`), giữ nguyên các dòng đó, chỉ thêm `JwtModule.registerAsync(...)` vào mảng `imports`.

Chạy `npm run build` để chắc không lỗi, rồi thử inject `JwtService` vào constructor `AuthService` (làm ở Bước 3). Nếu bước này đã đúng, sẽ không có lỗi "no provider found".

---

## Bước 2: Viết DTO cho input login và 2 response DTO

Bạn cần 3 class: dữ liệu login client gửi lên, và 2 DTO response theo đúng allow-list ở [00-overview.md § 5](./00-overview.md).

```powershell
New-Item src/auth/dto/login.dto.ts -ItemType File   # PowerShell
New-Item src/auth/dto/auth-user-response.dto.ts -ItemType File
New-Item src/auth/dto/login-response.dto.ts -ItemType File
```

```bash
touch src/auth/dto/login.dto.ts src/auth/dto/auth-user-response.dto.ts src/auth/dto/login-response.dto.ts   # Bash (Git Bash/WSL)
```

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

  @ApiProperty()
  fullName: string;

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

`AuthUserResponseDto` là DTO dùng chung: [08-me.md](./08-me.md) (`GET /auth/me`) sẽ tái sử dụng lại, không tạo trùng. Xong bước này, cả 3 file chỉ cần build không lỗi là đủ, chưa có logic gì để test.

---

## Bước 3: Viết hàm sinh access token

Trước khi viết `login()` đầy đủ, tách riêng phần sinh JWT access token thành 1 hàm helper, dùng lại được cả ở đây lẫn ở `06-refresh-token.md` sau này.

> 📘 **Khái niệm: JWT payload là gì, vì sao không nhét `passwordHash` vào?** JWT (JSON Web Token) gồm 3 phần: header, payload, signature. Payload là dữ liệu **ai cũng đọc được** nếu có token trong tay (chỉ mã hoá base64, không encrypt). Chữ ký (signature) chỉ đảm bảo payload không bị _sửa_, không đảm bảo payload được _giữ bí mật_. Vì vậy tuyệt đối không nhét `passwordHash`, refresh token, hay dữ liệu nhạy cảm vào payload: chỉ nhét thứ cần thiết để nhận diện user (`sub`, `email`, `roles`).
>
> 📘 **Khái niệm: vì sao access token là "stateless"?** JWT tự chứa đủ thông tin để verify (không cần tra DB). Server chỉ cần verify chữ ký bằng secret là biết token hợp lệ hay không, không cần lưu session ở đâu. Ưu điểm: nhanh, không tốn DB. Nhược điểm: **không thể "xoá" 1 token đã phát hành** trước khi nó tự hết hạn. Đây là lý do TTL access token phải ngắn (15 phút), xem 00-overview.md, phần Known Gaps § Access-token revocation tức thời.

Bổ sung vào `src/auth/services/auth.service.ts`:

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
  private signAccessToken(user: { id: string; email: string; roles: string[] }): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      roles: user.roles, // mảng string từ userRoles -> role.name — KHÔNG hardcode enum (quyết định #6)
    });
  }
}
```

Kiểm tra nhanh: decode thử access token (vd bằng https://jwt.io hoặc `jwtService.decode()`) phải thấy đúng `sub`, `email`, `roles`. Muốn chắc token hết hạn đúng TTL cấu hình (`JWT_ACCESS_TTL`), thử set TTL rất ngắn (vd `'1s'`) trong test env và chờ hết hạn trước khi verify lại.

---

## Bước 4: Viết logic login đầy đủ

Đây là phần orchestrate chính: tìm user → check 2 trục trạng thái → verify password → sinh access token + refresh token.

> 📘 **Khái niệm: vì sao "sai email" và "sai password" phải trả cùng 1 lỗi 401?** Nếu trả lỗi khác nhau ("Email không tồn tại" vs "Sai password"), kẻ tấn công dò được **email nào đã đăng ký** bằng cách thử login với password bất kỳ và đọc message: lại là user enumeration (xem 04-resend-verification.md). Login luôn trả `UnauthorizedException` chung chung cho cả 2 case.
>
> 📘 **Khái niệm: vì sao check 2 trục (`status` và `emailVerifiedAt`) tách biệt?** Theo quyết định #15 ([00-overview.md](./00-overview.md)), đây là 2 khái niệm độc lập: ADMIN có thể `BLOCKED` 1 tài khoản bất kể đã verify email hay chưa, và 1 tài khoản `ACTIVE` vẫn có thể chưa verify email. Login cần **cả hai** đúng mới cho qua (quyết định #1). Nhưng thông báo lỗi không được lộ chi tiết kiểu "email không tồn tại" cho case bị chặn.

```ts
// src/auth/services/auth.service.ts (thêm vào class AuthService)
import { UnauthorizedException } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';

// ... trong class AuthService

async login(dto: LoginDto): Promise<{
  accessToken: string;
  rawRefreshToken: string;
  user: { id: string; email: string; fullName: string; roles: string[]; emailVerified: boolean };
}> {
  const user = await this.prisma.user.findUnique({
    where: { email: dto.email },
    include: { userRoles: { include: { role: true } } },
  });

  // Không tồn tại → lỗi generic, KHÔNG phân biệt với sai password.
  if (!user) {
    throw new UnauthorizedException('Invalid email or password');
  }

  const passwordValid = await this.passwordService.verify(
    user.passwordHash,
    dto.password,
  );
  if (!passwordValid) {
    throw new UnauthorizedException('Invalid email or password');
  }

  // Kiểm tra CẢ HAI trục (quyết định #15) — SAU khi đã xác nhận password
  // đúng, để không lộ thêm thông tin cho kẻ đoán sai password.
  if (user.status === 'BLOCKED') {
    throw new UnauthorizedException('Account is locked');
  }
  if (!user.emailVerifiedAt) {
    throw new UnauthorizedException('Email is not verified');
  }

  const roles = user.userRoles.map((ur) => ur.role.name);
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
      fullName: user.fullName,
      roles,
      // Derive từ dữ liệu thật (không hardcode `true`): tại điểm này chắc
      // chắn email đã verify (đã check ở trên), nhưng derive vẫn an toàn
      // hơn — nếu logic check phía trên đổi mà quên sửa dòng này, hardcode
      // `true` sẽ âm thầm trả sai, còn derive luôn phản ánh đúng trạng thái.
      emailVerified: !!user.emailVerifiedAt,
    },
  };
}
```

⚠️ Tên relation `userRoles: { include: { role: true } }` giả định schema dạng `User.userRoles -> UserRole -> Role` (bảng nối `user_roles`). Đối chiếu đúng tên relation/field thật trong `prisma/schema/schema.prisma`. `fullName` là cột bắt buộc (`NOT NULL`) trên `User` (xem `02-register.md` Bước 1), nên luôn có giá trị, không cần xử lý `null`.

Để ý `login()` trả `rawRefreshToken` ra ngoài thay vì tự set cookie trong Service, vì **Service không nên biết về HTTP response/cookie**, đó là trách nhiệm của Controller (Bước 5). Giữ Service thuần business logic giúp unit test dễ hơn nhiều (không cần mock `Response`).

Tự kiểm tra: login đúng email/password với account `ACTIVE` + đã verify phải trả `accessToken` + `rawRefreshToken` + `user`. Sai password hoặc email không tồn tại phải trả cùng 1 `UnauthorizedException` (401) với message giống hệt nhau. Account `BLOCKED` bị chặn với message khác case sai password (nhưng vẫn không lộ kiểu "email này tồn tại"). Email chưa verify cũng bị chặn.

---

## Bước 5: Mở endpoint HTTP và set cookie refresh token

Bước cuối: expose route `POST /auth/login`, trả access token trong body, set refresh token qua cookie `HttpOnly`+`Secure`+`SameSite`.

> 📘 **Khái niệm: `@Res({ passthrough: true })` là gì, vì sao cần?** Bình thường NestJS tự lo việc set status code + serialize object trả về thành JSON response. Bạn chỉ cần `return` 1 object trong method Controller. Nhưng để **set cookie**, bạn cần truy cập trực tiếp đối tượng `Response` của Express (`response.cookie(...)`). Nếu inject `@Res() response: Response` mà không có `passthrough: true`, Nest coi như bạn **tự quản lý toàn bộ response**. `return` trong method sẽ bị bỏ qua, bạn phải tự gọi `response.json(...)`/`response.send(...)` mới trả được dữ liệu. Thêm `{ passthrough: true }` giữ nguyên cơ chế tự động của Nest (vẫn `return` object bình thường). Bạn chỉ dùng `response` để làm thêm việc phụ (set cookie) trước khi Nest tự serialize.

```ts
// src/auth/auth.controller.ts (thêm vào class AuthController)
import { Response } from 'express';
import { Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ms from 'ms'; // cùng package/cách parse TTL đã dùng ở TokenService (01-setup.md, phần TokenService đầy đủ)
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
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response): Promise<LoginResponseDto> {
    const { accessToken, rawRefreshToken, user } = await this.authService.login(dto);

    const cookieName = this.config.get<string>('REFRESH_TOKEN_COOKIE_NAME', 'refresh_token');
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
      // cùng cách đã dùng ở TokenService.createRefreshToken() (01-setup.md, phần TokenService đầy đủ).
      maxAge: ms(this.config.get<string>('REFRESH_TOKEN_TTL', '7d')),
    });

    return { accessToken, user };
  }
}
```

Gọi thử toàn bộ flow (Bước 1 → 5) qua Postman/curl để tự xác nhận: login đúng phải trả body `{ accessToken, user }`, **không có `refreshToken` trong body**; cookie refresh token được set với đủ flag `HttpOnly` + `Secure` + `SameSite`; sai password / email không tồn tại trả cùng 1 loại lỗi 401; account `BLOCKED` bị chặn với lỗi khác biệt rõ so với sai password nhưng không lộ kiểu enumeration; email chưa verify bị chặn. Khi viết test chính thức ở [13-testing.md](./13-testing.md), case login success cần assert cả 2 chiều: response body không chứa `refreshToken`, và `Set-Cookie` header có đủ flag. Không chỉ kiểm tra status code là đủ.

---

➡️ Tiếp theo: [06-refresh-token.md](./06-refresh-token.md)
