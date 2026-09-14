# 09 — Logout + Logout All

> Trước khi làm file này: xong [08-me.md](./08-me.md), và trước đó [05-login.md](./05-login.md) + [06-refresh-token.md](./06-refresh-token.md) — cookie refresh token phải được set đúng cách ở 2 file đó trước. Tham chiếu chung (Decisions, Security Rules...): [00-overview.md](./00-overview.md).

Đây là 2 endpoint kết thúc session — `logout` kết thúc 1 session, `logout-all` kết thúc toàn bộ session của user hiện tại. Cả hai dùng chung đúng 1 cơ chế (revoke `refresh_tokens` + xoá cookie) nên gộp vào 1 file, chia làm 2 bước.

---

## Bước 1 — Logout (`POST /auth/logout`)

> 📘 **Khái niệm — vì sao `path` khi `clearCookie()` phải khớp CHÍNH XÁC với `path` lúc `cookie()` set ra?** Browser không xoá cookie theo _tên_ không thôi — nó xác định 1 cookie bằng bộ 3 `(name, domain, path)`. Nếu bạn set cookie với `path: '/api/auth'` nhưng gọi `clearCookie(name, { path: '/auth' })` (thiếu tiền tố `/api`), browser coi đây là **2 cookie khác nhau về path** — lệnh xoá không tìm thấy cookie cần xoá, cookie cũ vẫn còn nguyên trên máy client dù server tưởng đã xoá. Đây là lỗi rất dễ gặp khi đổi global prefix (`app.setGlobalPrefix('api')`) mà quên sửa đồng bộ path ở tất cả những chỗ set/clear cookie.

Trước hết, thêm method vào `AuthService` — chỉ cần revoke đúng 1 refresh token (nếu tìm thấy và chưa revoke), không throw lỗi nếu không tìm thấy, để tránh lộ thông tin token có hợp lệ hay không:

```ts
// src/auth/services/auth.service.ts (thêm method vào class đã có)
async logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = this.tokenService.hashRawToken(rawRefreshToken);

  // Revoke đúng 1 refresh token (nếu tồn tại và chưa revoke) — không throw lỗi
  // nếu không tìm thấy, để tránh lộ thông tin token có hợp lệ hay không.
  await this.prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
```

Rồi nối route vào `AuthController` — đọc cookie từ request, gọi service, xoá cookie trong response:

```ts
// src/auth/auth.controller.ts (thêm vào class đã có)
import { Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

@UseGuards(JwtAuthGuard)
@Post('logout')
@HttpCode(HttpStatus.OK)
async logout(
  @Req() request: Request,
  @Res({ passthrough: true }) response: Response,
): Promise<MessageResponseDto> {
  const cookieName = this.config.get<string>('REFRESH_TOKEN_COOKIE_NAME', 'refresh_token');
  const rawRefreshToken = request.cookies?.[cookieName];

  if (rawRefreshToken) {
    await this.authService.logout(rawRefreshToken);
  }

  // `path` PHẢI khớp chính xác với path đã dùng lúc `response.cookie(...)` ở
  // 05-login.md / 06-refresh-token.md — xem concept box phía trên.
  response.clearCookie(cookieName, { path: '/auth' });

  return { message: 'Đã đăng xuất' };
}
```

⚠️ `@Res({ passthrough: true })` — truyền `passthrough: true` để Nest vẫn tự động serialize giá trị `return` thành response body; nếu thiếu `passthrough`, bạn phải tự gọi `response.send(...)` thủ công vì Nest coi như bạn đã tự quản lý toàn bộ response.

Tự kiểm tra: logout thành công thì refresh token đó không còn dùng được ở `/auth/refresh` nữa và cookie bị xoá (kiểm tra `Set-Cookie` header trong response có `Max-Age=0` hoặc tương đương). Nếu bạn có 2 session (2 refresh token khác nhau, vd login trên 2 trình duyệt), logout ở 1 session chỉ được revoke đúng session đó, session còn lại vẫn phải dùng được bình thường. Gọi `/auth/logout` mà không có access token hợp lệ phải nhận `401` — do `JwtAuthGuard` chặn từ trước, không phải logic bạn vừa viết.

---

## Bước 2 — Logout All (`POST /auth/logout-all`)

Tương tự Bước 1, nhưng lần này revoke **toàn bộ** refresh token còn hiệu lực của user, không chỉ 1 cái:

```ts
// src/auth/services/auth.service.ts (thêm method vào class đã có)
async logoutAll(userId: string): Promise<void> {
  await this.prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
```

```ts
// src/auth/auth.controller.ts (thêm vào class đã có)
@UseGuards(JwtAuthGuard)
@Post('logout-all')
@HttpCode(HttpStatus.OK)
async logoutAll(
  @CurrentUser() user: JwtPayload,
  @Res({ passthrough: true }) response: Response,
): Promise<MessageResponseDto> {
  await this.authService.logoutAll(user.sub);

  const cookieName = this.config.get<string>('REFRESH_TOKEN_COOKIE_NAME', 'refresh_token');
  response.clearCookie(cookieName, { path: '/auth' }); // path khớp Bước 1

  return { message: 'Đã đăng xuất khỏi tất cả thiết bị' };
}
```

Tự kiểm tra: tạo thử 3 session cho cùng 1 user (login 3 lần, ra 3 refresh token khác nhau), gọi `logout-all` một lần — cả 3 refresh token đó đều phải không dùng để refresh được nữa, và không ảnh hưởng gì tới refresh token của user khác. Tiện thể, nhớ kiểm tra lại `doc/module-auth.md` có dòng `POST /auth/logout-all` trong bảng API tổng kết chưa — việc này sẽ rà lại kỹ hơn ở [14-swagger-and-wrapup.md](./14-swagger-and-wrapup.md).

---

➡️ Tiếp theo: [10-forgot-password.md](./10-forgot-password.md)
