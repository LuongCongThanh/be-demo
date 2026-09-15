# Auth & Authorization — Overview & Reference

> Đây là file **tra cứu chung** — Scope, Decisions, Architecture, Security Rules, Shared Services, Testing Strategy, Definition of Done, Known Gaps. Các file `01-setup.md` → `14-swagger-and-wrapup.md` chứa hướng dẫn implement từng phần, và **link ngược lại đây** khi cần nhắc tới 1 decision/rule cụ thể — đọc file này trước khi bắt đầu code.
>
> 🆕 **Mới học backend?** Đọc [GLOSSARY.md](./GLOSSARY.md) trước — giải thích mọi thuật ngữ kỹ thuật xuất hiện xuyên suốt playbook (HTTP, JWT, DTO, Guard, ORM, transaction, hash...) bằng ngôn ngữ đơn giản. Các box "📘 Khái niệm" trong từng bước giải thích _quyết định thiết kế_ (vì sao làm vậy); glossary giải thích _từ ngữ_ (chữ đó nghĩa là gì).

---

## Bản đồ file (đọc theo thứ tự)

| #   | File                                                     | Nội dung                                                                                                                |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 00  | `00-overview.md` (file này)                              | Scope, Decisions, Architecture, Security Rules, Shared Services, Testing, DoD, Known Gaps                               |
| —   | [GLOSSARY.md](./GLOSSARY.md)                             | Giải thích thuật ngữ kỹ thuật (HTTP, NestJS, Auth/Security, Database, Testing, Tooling) — đọc trước nếu mới học backend |
| 01  | [01-setup.md](./01-setup.md)                             | CONTEXT.md, seed roles/admin, cài package, env vars, scaffold module, password policy, TokenService đầy đủ              |
| 02  | [02-register.md](./02-register.md)                       | `POST /auth/register` (6 bước)                                                                                          |
| 03  | [03-verify-email.md](./03-verify-email.md)               | `POST /auth/verify-email`                                                                                               |
| 04  | [04-resend-verification.md](./04-resend-verification.md) | `POST /auth/resend-verification`                                                                                        |
| 05  | [05-login.md](./05-login.md)                             | `POST /auth/login` + sinh access token                                                                                  |
| 06  | [06-refresh-token.md](./06-refresh-token.md)             | `POST /auth/refresh` — rotation + reuse detection                                                                       |
| 07  | [07-guards.md](./07-guards.md)                           | `JwtAuthGuard`, `@CurrentUser()`, `RolesGuard`, `OwnershipGuard`                                                        |
| 08  | [08-me.md](./08-me.md)                                   | `GET /auth/me`                                                                                                          |
| 09  | [09-logout.md](./09-logout.md)                           | `POST /auth/logout` + `POST /auth/logout-all`                                                                           |
| 10  | [10-forgot-password.md](./10-forgot-password.md)         | `POST /auth/forgot-password`                                                                                            |
| 11  | [11-reset-password.md](./11-reset-password.md)           | `POST /auth/reset-password`                                                                                             |
| 12  | [12-rate-limiting.md](./12-rate-limiting.md)             | `@nestjs/throttler` cho các endpoint nhạy cảm                                                                           |
| 13  | [13-testing.md](./13-testing.md)                         | Unit test + E2E test                                                                                                    |
| 14  | [14-swagger-and-wrapup.md](./14-swagger-and-wrapup.md)   | Swagger/OpenAPI, đồng bộ `doc/module-auth.md`, quality check cuối                                                       |

> Bản gốc dạng 1 file duy nhất (trước khi tách folder) được giữ lại ở `auth-engineering-playbook.md` làm archive tham khảo — không dùng để code theo nữa, mọi cập nhật từ nay áp dụng vào folder `doc/auth-playbook/` này.

---

## 1. Scope & Goal

Tài liệu này mô tả cách implement **Authentication & Authorization MVP** cho ecommerce backend.

### Bao gồm

- Register
- Email verification
- Resend verification
- Login
- Access token
- Refresh token rotation
- Refresh token reuse detection
- Logout
- Logout all devices
- Forgot password
- Reset password
- JWT authentication (`JwtAuthGuard`)
- Role-based authorization (`RolesGuard` + `@Roles()`)
- Ownership authorization (`OwnershipGuard`)
- Rate limiting (các endpoint nhạy cảm)
- Unit test / E2E test
- Swagger/OpenAPI

### Không bao gồm (out of scope cho MVP này)

- MFA (2FA)
- Social login (Google/Facebook...)
- Account lockout theo số lần sai password
- Device fingerprinting
- SSO (Single Sign-On)
- Permission matrix nâng cao (fine-grained permission ngoài Role + Ownership)
- Access-token revocation tức thời (denylist/token-version) — xem [Known Gaps](#10-known-gaps)

> Danh sách "không bao gồm" ở trên không phải bị cấm mãi mãi — chỉ ngoài phạm vi MVP này.

---

## 2. Decisions

| #   | Chủ đề                               | Quyết định                                                                                                                                                                       | Lý do                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Login khi chưa verify email          | Chặn hoàn toàn                                                                                                                                                                   | Tránh tài khoản chưa xác thực danh tính thao tác trên hệ thống (đặt hàng, thanh toán...)                                                                                                                                                                                           |
| 2   | Refresh token rotation               | Có, từ MVP                                                                                                                                                                       | Giảm rủi ro nếu refresh token bị đánh cắp — token cũ bị vô hiệu ngay sau khi dùng                                                                                                                                                                                                  |
| 3   | Reuse detection                      | Refresh token đã revoked mà bị dùng lại → revoke toàn bộ **refresh session** của user đó                                                                                         | Dấu hiệu refresh token bị đánh cắp. **Lưu ý:** chỉ thu hồi được các refresh token — access token JWT đã phát hành vẫn sống tới khi hết TTL (15 phút), vì đây là stateless token, xem [Known Gaps](#10-known-gaps)                                                                  |
| 4   | Account lockout (sai password N lần) | Chưa làm ở MVP                                                                                                                                                                   | Ưu tiên thấp hơn so với các rủi ro khác; rate limiting theo IP đã giảm phần nào rủi ro brute-force                                                                                                                                                                                 |
| 5   | CONTEXT.md                           | Viết lại theo domain ecommerce, bắt đầu từ Auth                                                                                                                                  | CONTEXT.md hiện mô tả domain "Todo List" cũ — sai hoàn toàn, gây nhầm lẫn cho người đọc sau                                                                                                                                                                                        |
| 6   | Role model                           | DB-driven (`roles.name` là data, không phải enum cứng)                                                                                                                           | Cho phép ADMIN tạo role mới (STAFF, WAREHOUSE...) qua data mà không cần sửa code/enum                                                                                                                                                                                              |
| 7   | Order "eligible" để cancel           | Chỉ `PENDING`                                                                                                                                                                    | `PAID` coi như đã thanh toán thành công, hủy cần flow refund riêng — ngoài scope auth                                                                                                                                                                                              |
| 8   | Token cũ khi resend/forgot-password  | Xoá (delete) token chưa dùng của user trước khi tạo token mới                                                                                                                    | Đơn giản, không cần sửa schema (schema hiện không có cột `revokedAt`/`invalidatedAt` cho 2 bảng token này)                                                                                                                                                                         |
| 9   | Password policy                      | Bắt buộc hoa + thường + số + ký tự đặc biệt, tối thiểu 8 ký tự                                                                                                                   | Cân bằng an toàn cho ecommerce có giao dịch tiền                                                                                                                                                                                                                                   |
| 10  | Email enumeration                    | `register` → 409 rõ ràng; `forgot-password` và `resend-verification` → message chung chung                                                                                       | Register cần UX rõ ràng (gợi ý login); các flow nhạy cảm hơn (reset password) cần giấu sự tồn tại của email                                                                                                                                                                        |
| 11  | Rate limiting                        | Áp dụng cho `login`, `forgot-password`, `resend-verification`, `register`, `verify-email`, `refresh` — threshold khác nhau tuỳ endpoint; implement ở giai đoạn gần cuối playbook | Các endpoint public-facing đều có rủi ro spam/brute-force/enumeration ở mức độ khác nhau, nhưng không block các business flow chính trong lúc dev                                                                                                                                  |
| 12  | Token TTL                            | Access 15 phút / Refresh 7 ngày, đọc qua `ConfigService`                                                                                                                         | Access ngắn để giảm thiệt hại nếu bị lộ; refresh 7 ngày phù hợp tần suất quay lại mua hàng                                                                                                                                                                                         |
| 13  | Ownership check                      | Guard/decorator dùng chung (`OwnershipGuard`), implementation MVP dùng callback `fetch` trực tiếp                                                                                | Tái sử dụng được cho nhiều resource (Order, Cart...) thay vì lặp code kiểm tra thủ công; xem [Known Gaps](#10-known-gaps) về coupling với Prisma                                                                                                                                   |
| 14  | Thuật ngữ "Session"                  | Một **phiên đăng nhập logic**, đại diện bởi một `RefreshToken` record. MVP không xác thực danh tính thiết bị vật lý                                                              | Tránh khẳng định quá chắc "1 Session = 1 thiết bị" khi chưa có device fingerprinting (ngoài scope)                                                                                                                                                                                 |
| 15  | Thuật ngữ trạng thái User            | Tách 2 trục: **Account status** (`User.status`: ACTIVE/BLOCKED) và **Email verification** (`emailVerifiedAt`) — login cần cả hai                                                 | Doc gốc gộp mơ hồ 2 trục độc lập, dễ gây bug logic                                                                                                                                                                                                                                 |
| 16  | Admin bootstrap                      | Seed script tạo sẵn 1 tài khoản ADMIN đầu tiên (email/password từ env)                                                                                                           | Không expose endpoint HTTP tạo ADMIN — giảm bề mặt tấn công                                                                                                                                                                                                                        |
| 17  | Refresh token delivery               | HttpOnly + Secure + SameSite cookie, `path` giới hạn theo prefix route auth thực tế (mặc định `/auth`) — server set, JS không đọc được, không trả trong response body            | Target chính là web browser; giảm rủi ro XSS đọc được refresh token so với để frontend lưu `localStorage`. Giới hạn `path` giúp cookie chỉ gửi kèm request tới route auth, không gửi tới toàn site. Access token vẫn trả trong response body (ngắn hạn, chấp nhận rủi ro thấp hơn) |
| 18  | Refresh token type                   | Opaque random token (không phải JWT) → hash SHA-256 → lưu `tokenHash`                                                                                                            | Khớp đúng với schema hiện tại (`refresh_tokens.tokenHash`, rotation, reuse detection) — không cần `JWT_REFRESH_SECRET` vì không ký/verify bằng JWT                                                                                                                                 |

### Lỗi cần sửa kèm trong `doc/module-auth.md`

- Bảng API tổng kết ở mục 4 thiếu dòng `POST /auth/logout-all`.
- Xem thêm [Known Gaps](#10-known-gaps) để cập nhật đồng bộ 2 file.

---

## 3. Architecture Overview

### Thành phần chính

```text
Client
  ↓
AuthController
  ↓
AuthService  (orchestrate business flow — KHÔNG tự làm hết mọi việc)
  ├── PrismaService       → truy vấn/ghi DB
  ├── PasswordService      → hash / verify password
  ├── TokenService         → generate / hash verification/reset/refresh token
  ├── MailService          → gửi verification/reset email (module riêng: src/mail/)
  └── JwtService (@nestjs/jwt) → sinh/verify access token
```

> **Nguyên tắc:** `AuthService` không tự hash password, tự sinh token thô, hay tự gọi SMTP — nó **điều phối** các service chuyên trách bên dưới. Chi tiết phân trách nhiệm ở [7. Shared Services](#7-shared-services).

### Request pipeline cho endpoint cần đăng nhập

```text
Authenticated request
      ↓
JwtAuthGuard        (xác thực JWT còn hạn, gắn CurrentUser vào request)
      ↓
@CurrentUser()       (decorator lấy user từ request)
      ↓
RolesGuard           (kiểm tra role, nếu route có @Roles(...))
      ↓
OwnershipGuard        (kiểm tra resource.userId === currentUser.id, nếu route có @OwnedResource(...))
      ↓
Controller
      ↓
Service               (business rule sâu hơn ownership — xem quy tắc Guard vs Service ở mục 5)
```

### Thứ tự triển khai tổng quát (theo tên file trong `doc/auth-playbook/`)

```text
01-setup.md   (domain decisions, schema readiness, shared services: Password/Token/Mail)
      ↓
02-register.md → 03-verify-email.md → 04-resend-verification.md
      ↓
05-login.md → 06-refresh-token.md
      ↓
07-guards.md (JwtAuth / Roles / Ownership)
      ↓
08-me.md
      ↓
09-logout.md
      ↓
10-forgot-password.md → 11-reset-password.md
      ↓
12-rate-limiting.md
      ↓
13-testing.md (Unit → E2E)
      ↓
14-swagger-and-wrapup.md (Swagger, đồng bộ doc, Lint → Build → PR)
```

---

## 4. Endpoint ↔ File tra cứu nhanh

| Endpoint                         | File                                                     | Success                                                        | Errors chính                             |
| -------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| `POST /auth/register`            | [02-register.md](./02-register.md)                       | 201, user tạo + email gửi                                      | 400, 409                                 |
| `POST /auth/verify-email`        | [03-verify-email.md](./03-verify-email.md)               | emailVerifiedAt được set                                       | 400 (hết hạn/không tồn tại/đã dùng)      |
| `POST /auth/resend-verification` | [04-resend-verification.md](./04-resend-verification.md) | message chung chung, token mới nếu hợp lệ                      | không có lỗi lộ enumeration              |
| `POST /auth/login`               | [05-login.md](./05-login.md)                             | access token (body) + refresh token (cookie)                   | 401 (generic), block BLOCKED/chưa verify |
| `POST /auth/refresh`             | [06-refresh-token.md](./06-refresh-token.md)             | access token mới (body) + refresh token mới (cookie, rotation) | 401 + revoke toàn bộ session nếu reuse   |
| `POST /auth/logout`              | [09-logout.md](./09-logout.md)                           | revoke 1 refresh token + xoá cookie                            | 401 nếu chưa login                       |
| `POST /auth/logout-all`          | [09-logout.md](./09-logout.md)                           | revoke toàn bộ refresh token + xoá cookie                      | 401 nếu chưa login                       |
| `POST /auth/forgot-password`     | [10-forgot-password.md](./10-forgot-password.md)         | message chung chung                                            | không có lỗi lộ enumeration              |
| `POST /auth/reset-password`      | [11-reset-password.md](./11-reset-password.md)           | password mới + revoke toàn bộ session                          | 400 (hết hạn/đã dùng/policy)             |
| `GET /auth/me`                   | [08-me.md](./08-me.md)                                   | AuthUserResponseDto                                            | 401                                      |

---

## 5. Security Rules

- Không lưu raw password.
- Không lưu raw refresh/reset/verification token — chỉ lưu hash.
- Không log password/token (kể cả log lỗi).
- Forgot password không expose user existence.
- Resend verification không expose user existence.
- Access token TTL ngắn (15 phút).
- Refresh token có rotation + reuse detection — **nhưng reuse detection không thu hồi access token đã phát hành**, chỉ giới hạn thiệt hại bằng TTL ngắn (xem [06-refresh-token.md](./06-refresh-token.md), [Known Gaps](#10-known-gaps)).
- Password reset revoke toàn bộ refresh session cũ.
- Secrets chỉ đọc qua `ConfigService`, không dùng `process.env` trực tiếp (trừ `prisma/seed.ts`).
- Không trả Prisma `User` (hay bất kỳ Prisma model nào) trực tiếp ra API — luôn qua Response DTO allow-list.
- Auth endpoints nhạy cảm (`login`, `forgot-password`, `resend-verification`, `register`, `verify-email`, `refresh`) phải rate limit (quyết định #11).
- Refresh token luôn nằm trong cookie `HttpOnly` + `Secure` + `SameSite` + `path` giới hạn theo route auth thực tế, **không bao giờ** xuất hiện trong response body hay query string (quyết định #17).
- **Cross-origin frontend/backend** (frontend deploy ở domain/subdomain khác backend): xem [Known Gaps](#10-known-gaps) — cần đồng bộ cấu hình `SameSite`, CORS `credentials`, và frontend phải gửi `credentials: 'include'`, nếu không cookie sẽ không được browser gửi kèm request.
- **Guard vs Service**: Guard chỉ xử lý access-level rule (JWT hợp lệ? có role? có phải chủ resource?). Business-level rule (trạng thái đơn hàng, payment state, ràng buộc nghiệp vụ khác) luôn nằm ở Service, không nhét vào Guard.
  - Ví dụ: `GET /orders/:id` → chỉ cần `OwnershipGuard`.
  - `POST /orders/:id/cancel` → ownership **không đủ**, cần thêm `status === PENDING` (quyết định #7) — kiểm tra này nằm trong `OrderService`, không phải Guard.

### Response DTO bắt buộc

Toàn bộ endpoint `/auth/*` trả qua Response DTO allow-list — không có endpoint nào trả thẳng object nội bộ:

```ts
class AuthUserResponseDto {
  id: string;
  email: string;
  fullName: string | null;
  roles: string[];
  emailVerified: boolean;
}

class LoginResponseDto {
  accessToken: string;
  user: AuthUserResponseDto;
  // KHÔNG có refreshToken — nằm trong cookie (quyết định #17)
}

class RefreshResponseDto {
  accessToken: string;
  // KHÔNG có refreshToken — cookie mới được set qua Set-Cookie header, không lặp lại trong body
}

class RegisterResponseDto {
  id: string;
  email: string;
  // KHÔNG có accessToken/refreshToken — register không tự động login (quyết định #1)
}

class MessageResponseDto {
  message: string;
  // dùng cho: verify-email, resend-verification, forgot-password, reset-password, logout, logout-all
}
```

| Endpoint                         | DTO                   |
| -------------------------------- | --------------------- |
| `POST /auth/register`            | `RegisterResponseDto` |
| `POST /auth/verify-email`        | `MessageResponseDto`  |
| `POST /auth/resend-verification` | `MessageResponseDto`  |
| `POST /auth/login`               | `LoginResponseDto`    |
| `POST /auth/refresh`             | `RefreshResponseDto`  |
| `POST /auth/logout`              | `MessageResponseDto`  |
| `POST /auth/logout-all`          | `MessageResponseDto`  |
| `POST /auth/forgot-password`     | `MessageResponseDto`  |
| `POST /auth/reset-password`      | `MessageResponseDto`  |
| `GET /auth/me`                   | `AuthUserResponseDto` |

Không bao giờ trả: `passwordHash`, `refreshTokens`/refresh token thô (dù trong body hay log), `tokenHash`, hay bất kỳ metadata DB nội bộ nào khác.

---

## 6. Shared Services

| Service           | Trách nhiệm                                                                                       | Vị trí                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `AuthService`     | Orchestrate business flow (register/login/refresh/...), gọi các service bên dưới theo đúng thứ tự | `src/auth/services/auth.service.ts`                           |
| `PasswordService` | Hash / verify password (argon2)                                                                   | `src/auth/services/password.service.ts`                       |
| `TokenService`    | Generate + hash token (email verification / password reset / refresh); xoá token cũ chưa dùng     | `src/auth/services/token.service.ts`                          |
| `MailService`     | Gửi verification email / reset password email                                                     | `src/mail/mail.service.ts` (module riêng, đứng ngoài `auth/`) |
| `JwtService`      | Sinh & verify access token (built-in từ `@nestjs/jwt`)                                            | dùng trực tiếp, không cần wrap thêm                           |

**Nguyên tắc:** `AuthService` không tự làm hết mọi việc (tránh thành God Service) — nó chỉ điều phối. Nhờ tách vậy, `PasswordService`/`TokenService` dễ unit test độc lập (không cần mock DB/HTTP).

### Contract của MailService

**MVP: inject trực tiếp class cụ thể**, không dùng TS `interface` làm token DI — TypeScript interface biến mất ở runtime, Nest không thể inject nó bằng `@Inject()` mà không có token riêng.

```ts
// src/mail/mail.service.ts
@Injectable()
export class MailService {
  async sendVerificationEmail(to: string, rawToken: string): Promise<void> { /* ... */ }
  async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> { /* ... */ }
}

// AuthService
constructor(private readonly mailService: MailService) {}
```

```text
AuthService
   ↓
MailService (class cụ thể, inject trực tiếp)
   ↓
SMTP / SES / Resend / SendGrid (implementation cụ thể, nằm trong MailService)
```

`auth` module không cần biết `MailService` gọi SMTP/SES/SendGrid nào bên trong — nhưng KHÔNG cần tách interface + DI token riêng cho MVP.

> **Chỉ tách abstraction khi thực sự cần đổi provider** (vd cần A/B giữa SES và SendGrid theo config): lúc đó mới thêm token DI dạng `Symbol`:
>
> ```ts
> export const MAIL_SERVICE = Symbol('MAIL_SERVICE');
> export interface IMailService { sendVerificationEmail(...): Promise<void>; /* ... */ }
> // provider: { provide: MAIL_SERVICE, useClass: SesMailService }
> // inject: constructor(@Inject(MAIL_SERVICE) private readonly mail: IMailService) {}
> ```
>
> Không làm việc này trước — thêm abstraction khi chưa có 2 implementation thật là over-engineering.

### Rule: Transaction không bọc external call

```text
Không nên:
DB transaction {
  create user
  create token
  send external email   ← SAI: external call trong transaction
}

Nên:
DB transaction
├── create user
├── assign role
└── create token
      ↓
commit
      ↓
send email   (ngoài transaction)
```

Nếu gửi mail fail: log lại, **không rollback DB** — user đã tồn tại hợp lệ và có thể tự resend verification ([04-resend-verification.md](./04-resend-verification.md)) để nhận lại.

---

## 7. Testing Strategy

Theo `doc/api-conventions.md`: nhóm `auth` là **bắt buộc phải có e2e test**. Unit test bắt buộc cho mọi service có business logic (`AuthService`, `TokenService`, `PasswordService`).

| Endpoint                             | Happy path | Validation | Auth | Security | Edge case |
| ------------------------------------ | :--------: | :--------: | :--: | :------: | :-------: |
| register                             |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| verify-email                         |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| resend-verification                  |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| login                                |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| refresh (rotation + reuse detection) |     ✓      |     ✓      |  ✓   |    ✓     |     ✓     |
| logout                               |     ✓      |     –      |  ✓   |    –     |     ✓     |
| logout-all                           |     ✓      |     –      |  ✓   |    –     |     ✓     |
| forgot-password                      |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| reset-password                       |     ✓      |     ✓      |  –   |    ✓     |     ✓     |
| /auth/me                             |     ✓      |     –      |  ✓   |    ✓     |     –     |
| RolesGuard                           |     ✓      |     –      |  ✓   |    ✓     |     ✓     |
| OwnershipGuard                       |     ✓      |     –      |  ✓   |    ✓     |     ✓     |
| Rate limiting (per endpoint)         |     ✓      |     –      |  –   |    ✓     |     ✓     |

"Security" cột ở trên = test riêng cho các rule ở mục 5 (không leak field, không lộ enumeration, rate limit có hoạt động, reuse detection có revoke đúng phạm vi...). Chi tiết test case đầy đủ nằm trong [13-testing.md](./13-testing.md).

---

## 8. Definition of Done

Auth MVP chỉ được coi là hoàn thành khi:

- [ ] Register hoạt động
- [ ] Verify email hoạt động
- [ ] Resend verification hoạt động
- [ ] Login chặn unverified user
- [ ] Login chặn BLOCKED user
- [ ] Access token hoạt động
- [ ] Refresh rotation hoạt động
- [ ] Reuse detection hoạt động (đúng phạm vi: chỉ revoke refresh token, không claim revoke access token)
- [ ] Logout hoạt động
- [ ] Logout all hoạt động
- [ ] Forgot/reset password hoạt động
- [ ] Password reset revoke toàn bộ refresh session
- [ ] JwtAuthGuard hoạt động
- [ ] RolesGuard hoạt động
- [ ] OwnershipGuard hoạt động (chỉ ownership, business rule để ở Service)
- [ ] Rate limiting hoạt động trên `login`, `forgot-password`, `resend-verification`, `register`, `verify-email`, `refresh` (per-email tracking cho 2 endpoint cần custom, không phải default throttler)
- [ ] Refresh token luôn nằm trong cookie `HttpOnly`+`Secure`+`SameSite`, không bao giờ xuất hiện trong response body/log
- [ ] Mọi response `/auth/*` dùng đúng Response DTO ở bảng mục 5 (không có endpoint nào trả object nội bộ)
- [ ] Không leak sensitive field (passwordHash, tokenHash...) qua bất kỳ response nào
- [ ] Toàn bộ error response của `/auth/*` tuân theo error envelope chung `{ statusCode, message }` (theo `doc/api-conventions.md` §7 — lưu ý `PrismaExceptionFilter` global **chưa được implement** trong repo, là gap đã biết non-blocking; lỗi domain đã biết trước ở auth (409 email tồn tại, 401 sai credential...) phải tự ném exception có message rõ ràng ở service, không phó mặc cho filter chưa tồn tại)
- [ ] Unit tests pass (`npm run test`)
- [ ] `npm run test:cov` đạt threshold coverage của project
- [ ] E2E tests pass (`npm run test:e2e`, bắt buộc theo `doc/api-conventions.md`)
- [ ] Swagger đúng contract
- [ ] `npm run lint` pass
- [ ] `npm run format` (hoặc format check) pass
- [ ] `npm run build` pass
- [ ] Không có secret/token/password nào xuất hiện trong log
- [ ] `doc/module-auth.md` đã đồng bộ lại ([14-swagger-and-wrapup.md](./14-swagger-and-wrapup.md))
- [ ] PR reviewed

---

## 9. Known Gaps

Các điểm cố ý để ngoài scope MVP này, ghi lại để không bị quên và không bị hiểu nhầm là thiếu sót:

- **Access-token revocation tức thời** — Reuse detection (quyết định #3) chỉ revoke được refresh token; access token JWT đã phát hành vẫn hợp lệ tới khi hết TTL (15 phút) vì là stateless token. Nếu cần thu hồi access token ngay lập tức (vd tài khoản bị compromise nghiêm trọng), cần thêm cơ chế denylist (Redis TTL theo `jti`) hoặc token-version trong `User` (increment version → middleware so khớp version trong JWT payload với version hiện tại của user). **Chưa cần cho MVP** vì TTL ngắn đã giới hạn thiệt hại.
- **CSRF protection cho cookie-based refresh** — `/auth/refresh` và `/auth/logout` đọc refresh token từ cookie (quyết định #17), browser tự động gửi cookie kèm mọi request cùng origin → có rủi ro CSRF về lý thuyết trên các endpoint này. MVP giảm rủi ro bằng `SameSite=Strict/Lax`, **chưa implement CSRF token riêng (double-submit cookie hoặc header đồng bộ)**. Cân nhắc thêm nếu audit bảo mật yêu cầu, hoặc nếu sau này cần `SameSite=None` (cross-origin frontend/backend).
- **Frontend/backend deploy khác origin — phân biệt rõ "cross-origin" vs "cross-site"** (2 khái niệm khác nhau, dễ nhầm dẫn tới cấu hình cookie sai):
  - **Cross-origin nhưng vẫn same-site** (khác subdomain, chung **registrable domain** — vd frontend `app.example.com` gọi API `api.example.com`): đây vẫn là **same-site** theo định nghĩa trình duyệt. `SameSite=Strict` hoặc `Lax` **vẫn hoạt động bình thường**, KHÔNG cần đổi sang `None`. Cookie chỉ cần backend nhận tại domain của chính nó (vd `api.example.com`) — **mặc định để host-only cookie (không set `Domain`)**, an toàn hơn vì browser chỉ gửi cookie đúng cho `api.example.com`, không lan sang các subdomain khác. Chỉ set `domain: '.example.com'` (cookie dùng chung nhiều subdomain) khi **thật sự** có nhu cầu đó (vd nhiều service ở nhiều subdomain cùng cần đọc cookie này) — không set mặc định "cho chắc". Ngoài ra cần CORS `credentials: true` + `origin` khai rõ subdomain frontend + frontend gọi `credentials: 'include'`.
  - **Cross-site thật sự** (registrable domain khác nhau hoàn toàn — vd frontend `shop.com` gọi API ở `vendor-api.io`): trường hợp này mới bắt buộc `sameSite: 'none'` (đi kèm `secure: true`, không hoạt động qua HTTP), cộng thêm CORS `credentials: true` + `origin` cụ thể (không thể `origin: '*'` khi `credentials: true`) + frontend `credentials: 'include'`. `SameSite=None` làm tăng bề mặt CSRF đáng kể hơn `Strict`/`Lax` — nên triển khai CSRF token riêng (xem gạch đầu dòng CSRF phía trên) cùng lúc, không để rời.
  - **Chưa làm ở MVP này** cho cả 2 case trên — playbook mặc định giả định frontend/backend cùng site đơn giản nhất (không subdomain khác nhau). Thiếu `credentials: 'include'` ở frontend (dù case nào) sẽ khiến browser **không gửi** cookie refresh token kèm request, `/auth/refresh` luôn thất bại dù cookie tồn tại trên máy client — lỗi này dễ nhầm với bug backend nên cần lưu ý riêng.
- **MailService abstraction (interface + DI token)** — MVP inject trực tiếp class `MailService` cụ thể (xem [7. Shared Services](#7-shared-services)), chưa tách interface + `Symbol` token. Chỉ cần làm khi thực sự có ≥ 2 provider email cần đổi qua lại theo config.
- **Refresh token session family (`familyId`)** — MVP hiện revoke **toàn bộ** active refresh session khi phát hiện reuse. Nếu sau này muốn revoke theo từng token family/device thay vì toàn account, cần bổ sung schema:
  ```text
  RefreshToken
  ├── id
  ├── userId
  ├── familyId
  ├── tokenHash
  ├── revokedAt
  └── replacedByTokenId
  ```
  Cải tiến tương lai, **không bắt buộc cho MVP**.
- **OwnershipGuard coupling với Prisma** — implementation MVP dùng callback `fetch` trực tiếp trong decorator metadata ([07-guards.md](./07-guards.md)), gây coupling khá mạnh với Prisma. Hướng cải tiến tương lai: `@OwnedResource('order')` + guard gọi qua một provider/registry chuyên resolve ownership theo resource type, tách khỏi Prisma trực tiếp. **Không cần đổi ngay.**
- **TokenService trong transaction của `AuthService.register()`** — `TokenService` (01-setup.md, phần TokenService đầy đủ) tự inject `PrismaService` riêng, không tham gia chung transaction với `AuthService.register()` được — 02-register.md, phần AuthService.register() dùng 1 helper viết tay trùng lặp code nhỏ để giải quyết tạm. Cải tiến tương lai: refactor `TokenService` nhận `tx` qua tham số thay vì tự inject `this.prisma`. **Không bắt buộc cho MVP.**
- **MFA (2FA)** — ngoài scope, cân nhắc khi có yêu cầu bảo mật cao hơn (vd tài khoản ADMIN).
- **Social login** — ngoài scope.
- **Account lockout theo số lần sai password** — ngoài scope MVP (quyết định #4); rate limiting theo IP tạm thời thay thế.
- **Device fingerprinting** — ngoài scope. Vì vậy thuật ngữ "Session" (quyết định #14) chỉ là phiên đăng nhập logic, không xác thực được đây có đúng là 1 thiết bị vật lý hay không.
- **SSO** — ngoài scope.
- **Permission matrix nâng cao** (permission rời rạc ngoài Role + Ownership) — ngoài scope; Role + Ownership + business rule trong Service là đủ cho MVP.
- **`doc/module-auth.md` cần đồng bộ lại** theo [14-swagger-and-wrapup.md](./14-swagger-and-wrapup.md) — chưa làm thì hai file sẽ lệch nhau.
