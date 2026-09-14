# 06 — Refresh Token: rotation + reuse detection (`POST /auth/refresh`)

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [05-login.md](./05-login.md) — access token và refresh token cookie đã hoạt động khi login. Cần tra thuật ngữ nào đó thì mở [GLOSSARY.md](./GLOSSARY.md); cần nhắc lại quyết định thiết kế thì xem [00-overview.md](./00-overview.md).

Endpoint này cấp access token mới từ refresh token hợp lệ (đọc từ cookie), xoay vòng refresh token (rotation), và phát hiện refresh token bị tái sử dụng sau khi đã revoke (reuse detection). File này chia thành 4 bước: cài `cookie-parser` (hạ tầng còn thiếu) → DTO/response → logic rotation+reuse detection → controller.

---

## Bước 1 — Cài `cookie-parser`

Bạn cần có `request.cookies` trong mọi request, vì `/auth/refresh` và `/auth/logout` (xem [09-logout.md](./09-logout.md)) đọc refresh token từ cookie, không phải từ body.

> 📘 **Khái niệm — vì sao cần middleware `cookie-parser`?** Express (nền tảng HTTP mà NestJS dùng bên dưới) **không tự parse cookie** từ header `Cookie:` của request — mặc định `request.cookies` là `undefined`. Middleware `cookie-parser` đọc header đó và điền `request.cookies` thành 1 object dễ dùng (`request.cookies['refresh_token']`). Không có middleware này, code đọc cookie ở Bước 3 sẽ luôn nhận `undefined`.

Cài package:

```bash
npm install cookie-parser
npm install -D @types/cookie-parser
```

Rồi thêm vào `main.ts`, ngay trước `app.listen()`:

```ts
// src/main.ts (thêm vào hàm bootstrap(), TRƯỚC app.listen())
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ...các app.use/app.enableCors đã có
  app.use(cookieParser());
  // ...
  await app.listen(3000);
}
```

Muốn chắc chắn nó chạy đúng, gửi 1 request bất kỳ kèm header `Cookie: test=1`, rồi log tạm `request.cookies` trong 1 route nào đó — bạn sẽ thấy `{ test: '1' }` thay vì `undefined`.

---

## Bước 2 — RefreshResponseDto

Response DTO cho `/auth/refresh` chỉ cần trả access token mới:

```powershell
New-Item src/auth/dto/refresh-response.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/refresh-response.dto.ts   # Bash (Git Bash/WSL)
```

```ts
// src/auth/dto/refresh-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class RefreshResponseDto {
  @ApiProperty()
  accessToken: string;
  // KHÔNG có refreshToken — cookie mới được set qua Set-Cookie header,
  // không lặp lại trong body.
}
```

Bạn không cần DTO cho request — `/auth/refresh` đọc raw refresh token từ **cookie**, không nhận từ request body/param (quyết định #17). File compile được là xong bước này.

---

## Bước 3 — Logic rotation + reuse detection trong AuthService

Đây là phần cốt lõi: verify refresh token hợp lệ → nếu đã bị revoke trước đó (reuse) → revoke toàn bộ session của user; nếu hợp lệ → xoay vòng (revoke cũ, tạo mới).

> 📘 **Khái niệm — "rotation" (xoay vòng refresh token) là gì, vì sao làm vậy?** Mỗi lần `/auth/refresh` được gọi thành công, refresh token **cũ bị vô hiệu ngay lập tức** và 1 token **mới** được cấp — token cũ không dùng lại được nữa dù vẫn còn hạn. Lợi ích: nếu 1 refresh token bị đánh cắp và kẻ tấn công dùng nó, lần dùng tiếp theo của **chủ sở hữu hợp lệ** (với token cũ hơn mà họ vẫn đang cầm) sẽ bị phát hiện là "dùng lại token đã revoke" → kích hoạt reuse detection bên dưới.
>
> 📘 **Khái niệm — "reuse detection" hoạt động như thế nào?** Khi 1 refresh token có `revokedAt != null` (đã bị rotation trước đó) nhưng vẫn bị gửi lên `/auth/refresh` lần nữa, đây là **dấu hiệu rõ ràng** rằng có 2 bên khác nhau đang cùng cầm bản sao token đó — tức là token đã bị lộ (đánh cắp). Phản ứng: coi TOÀN BỘ session của user đó là không đáng tin, revoke hết, buộc user phải login lại từ đầu ở mọi thiết bị.
>
> ⚠️ **Giới hạn đã biết:** reuse detection chỉ revoke được **refresh token** — access token JWT đã phát hành trước đó (nếu có) vẫn hợp lệ tới khi hết TTL (15 phút) vì là stateless token (xem [00-overview.md § Known Gaps](./00-overview.md)). Đừng viết test/assert kỳ vọng access token bị vô hiệu ngay — điều đó sai với thiết kế hiện tại.

Thêm method sau vào `src/auth/services/auth.service.ts`:

```ts
// src/auth/services/auth.service.ts (thêm vào class AuthService)
import { UnauthorizedException } from '@nestjs/common';

// ... trong class AuthService

async refreshToken(rawRefreshToken: string | undefined): Promise<{
  accessToken: string;
  newRawRefreshToken: string;
}> {
  if (!rawRefreshToken) {
    throw new UnauthorizedException('Thiếu refresh token');
  }

  const tokenHash = this.tokenService.hashRawToken(rawRefreshToken);
  const record = await this.prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { userRoles: { include: { role: true } } } } },
  });

  if (!record) {
    throw new UnauthorizedException('Refresh token không hợp lệ');
  }

  // --- Reuse detection (quyết định #3) ---
  if (record.revokedAt) {
    await this.prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedException(
      'Refresh token đã bị thu hồi — toàn bộ phiên đăng nhập đã bị đăng xuất vì lý do bảo mật',
    );
  }

  if (record.expiresAt < new Date()) {
    throw new UnauthorizedException('Refresh token đã hết hạn');
  }

  // --- Rotation: revoke token cũ, tạo token mới ---
  await this.prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });
  const newRawRefreshToken = await this.tokenService.createRefreshToken(
    record.userId,
  );

  const roles = record.user.userRoles.map((ur) => ur.role.name);
  const accessToken = this.signAccessToken({
    id: record.user.id,
    email: record.user.email,
    roles,
  });

  return { accessToken, newRawRefreshToken };
}
```

⚠️ Tên field (`refreshToken`, `tokenHash`, `revokedAt`, `expiresAt`, `userId`) phải khớp `prisma/schema.prisma` — đối chiếu trước khi paste.

⚠️ **CSRF note** (xem [00-overview.md § Known Gaps](./00-overview.md)): vì refresh token nằm trong cookie, browser tự động gửi kèm mọi request cùng origin — `/auth/refresh` và `/auth/logout` là state-changing endpoint đọc cookie, cần `SameSite=Strict` (đã set ở [05-login.md](./05-login.md)) để giảm rủi ro CSRF. Không tự implement CSRF token riêng cho MVP.

Muốn tự kiểm chứng, thử refresh thành công trước — bạn sẽ nhận `accessToken` mới cùng `newRawRefreshToken` mới, và refresh token cũ (đã revoke) không dùng lại được nữa. Gọi mà không truyền refresh token phải bị `UnauthorizedException` (401), refresh token hết hạn cũng vậy. Trường hợp thú vị nhất: dùng lại 1 refresh token đã revoked — không chỉ bản thân request đó bị 401, mà **toàn bộ refresh token khác còn hiệu lực của user đó cũng bị revoke theo** (verify bằng cách gọi refresh với 1 token khác của cùng user ngay sau đó → cũng phải 401). Đừng kỳ vọng access token cũ bị vô hiệu ngay lập tức — điều đó sai với thiết kế đã giải thích ở box khái niệm phía trên.

---

## Bước 4 — Mở endpoint HTTP (AuthController)

Cuối cùng, đọc cookie từ request, gọi service, rồi set cookie mới trong response:

```ts
// src/auth/auth.controller.ts (thêm vào class AuthController)
import { Req } from '@nestjs/common';
import { Request } from 'express';
import ms from 'ms'; // cùng package/cách parse TTL đã dùng ở TokenService (01-setup.md, phần TokenService đầy đủ) và ở 05-login.md
import { RefreshResponseDto } from './dto/refresh-response.dto';

// ... trong class AuthController

@Post('refresh')
@HttpCode(HttpStatus.OK)
async refresh(
  @Req() request: Request,
  @Res({ passthrough: true }) response: Response,
): Promise<RefreshResponseDto> {
  const cookieName = this.config.get<string>(
    'REFRESH_TOKEN_COOKIE_NAME',
    'refresh_token',
  );
  const rawRefreshToken = request.cookies?.[cookieName] as string | undefined;

  const { accessToken, newRawRefreshToken } =
    await this.authService.refreshToken(rawRefreshToken);

  // Cookie mới — CÙNG path/flag như lúc set ở login (05-login.md), nếu không
  // khớp path browser sẽ coi đây là cookie khác, không ghi đè cookie cũ.
  response.cookie(cookieName, newRawRefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/auth',
    // Đọc TTL qua ConfigService, KHÔNG hardcode số ms — parse bằng `ms()`,
    // cùng cách đã dùng ở TokenService.createRefreshToken() (01-setup.md, phần TokenService đầy đủ) và 05-login.md.
    maxAge: ms(this.config.get<string>('REFRESH_TOKEN_TTL', '7d')),
  });

  return { accessToken };
}
```

`request.cookies?.[cookieName]` chỉ hoạt động sau khi Bước 1 (`cookie-parser`) đã bật — nếu vẫn nhận `undefined` dù browser có gửi cookie, quay lại kiểm tra `app.use(cookieParser())` trong `main.ts`.

Verify lại toàn bộ flow 1-4: refresh thành công phải trả access token mới trong body kèm cookie refresh token mới; không có cookie refresh token → 401; refresh token hết hạn → 401; dùng lại refresh token đã revoked → 401 và toàn bộ refresh token khác của user bị revoke theo (gọi `/auth/refresh` với 1 refresh token khác của cùng user cũng phải 401). Với testing (unit + e2e chi tiết ở [13-testing.md](./13-testing.md)), nhớ cover đủ 3 kịch bản: refresh thành công kèm rotation (cookie cũ không dùng lại được), refresh với cookie thiếu/hết hạn, và reuse detection (dùng cookie đã rotate làm tất cả refresh token khác của user cũng bị revoke).

---

➡️ Tiếp theo: [07-guards.md](./07-guards.md)
