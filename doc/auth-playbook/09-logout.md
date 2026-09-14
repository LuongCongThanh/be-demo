# 09 — Logout + Logout All

> ⬅️ Trước khi làm file này: xong [08-me.md](./08-me.md), và trước đó [05-login.md](./05-login.md) + [06-refresh-token.md](./06-refresh-token.md) (cookie refresh token đã được set đúng cách ở 2 file đó).
> 📚 Tham chiếu chung (Decisions, Security Rules...): [00-overview.md](./00-overview.md).

**Goal:** Kết thúc session — 1 session (`logout`) hoặc toàn bộ session (`logout-all`) của user hiện tại. 2 endpoint này dùng chung 1 cơ chế (revoke `refresh_tokens` + xoá cookie) nên gộp vào 1 file.

---

## STEP 18 — Logout (`POST /auth/logout`) — 🔴 Chưa làm

**Goal:** Kết thúc 1 session (1 refresh token).

**Files:** `src/auth/services/auth.service.ts`, `src/auth/auth.controller.ts`

> 📘 **Khái niệm — vì sao `path` khi `clearCookie()` phải khớp CHÍNH XÁC với `path` lúc `cookie()` set ra?** Browser không xoá cookie theo _tên_ không thôi — nó xác định 1 cookie bằng bộ 3 `(name, domain, path)`. Nếu bạn set cookie với `path: '/api/auth'` nhưng gọi `clearCookie(name, { path: '/auth' })` (thiếu tiền tố `/api`), browser coi đây là **2 cookie khác nhau về path** — lệnh xoá không tìm thấy cookie cần xoá, cookie cũ vẫn còn nguyên trên máy client dù server tưởng đã xoá. Đây là lỗi rất dễ gặp khi đổi global prefix (`app.setGlobalPrefix('api')`) mà quên sửa đồng bộ path ở tất cả những chỗ set/clear cookie.

**Implementation:**

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

> ⚠️ `@Res({ passthrough: true })` — truyền `passthrough: true` để Nest vẫn tự động serialize giá trị `return` thành response body; nếu thiếu `passthrough`, bạn phải tự gọi `response.send(...)` thủ công vì Nest coi như bạn đã tự quản lý toàn bộ response.

**Acceptance Criteria:**

- [ ] Logout thành công → refresh token đó không dùng để `/auth/refresh` được nữa; cookie bị xoá.
- [ ] Logout không ảnh hưởng session khác của cùng user.

**Tests:**

- logout thành công → cookie bị xoá (kiểm tra `Set-Cookie` header trong response có `Max-Age=0` hoặc tương đương), refresh token cũ dùng lại → 401.
- logout khi có 2+ session (2 refresh token khác nhau) → chỉ session hiện tại bị revoke, session còn lại vẫn dùng được.
- gọi `/auth/logout` không có token access hợp lệ → 401 (chặn bởi `JwtAuthGuard`).

---

## STEP 19 — Logout All (`POST /auth/logout-all`) — 🔴 Chưa làm

**Goal:** Kết thúc toàn bộ session của user hiện tại.

**Files:** `src/auth/services/auth.service.ts`, `src/auth/auth.controller.ts`

**Implementation:**

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
  response.clearCookie(cookieName, { path: '/auth' }); // path khớp STEP 18

  return { message: 'Đã đăng xuất khỏi tất cả thiết bị' };
}
```

**Acceptance Criteria:**

- [ ] Sau logout-all, mọi refresh token trước đó của user đều không dùng được; cookie hiện tại bị xoá.

**Tests:**

- user có 3 session (3 refresh token) → gọi logout-all → cả 3 đều không refresh được nữa.
- logout-all không ảnh hưởng user khác.

**Ghi chú đồng bộ doc:** đảm bảo `doc/module-auth.md` có dòng `POST /auth/logout-all` trong bảng API tổng kết — kiểm tra lại khi làm [14-swagger-and-wrapup.md](./14-swagger-and-wrapup.md).

---

➡️ Tiếp theo: [10-forgot-password.md](./10-forgot-password.md)
