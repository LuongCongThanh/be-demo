# 05. Xác thực, phân quyền và bảo mật

> Trạng thái: **Đã chốt cho MVP**. Nguồn nghiệp vụ: [business/02](../business/02-actors-permissions.md), [business/03](../business/03-user-stories.md) E5, [business/06](../business/06-compliance.md). Quyết định: [ADR 0005](../adr/0005-four-actor-authorization-model.md), [ADR 0011](../adr/0011-guest-identity-by-order-code-and-phone.md).

## 1. Các lớp bảo mật

```text
Internet → CDN/WAF → Load balancer (TLS) → Rate limiting → Xác thực → Phân quyền
        → Validate input (DTO) → Business logic → PostgreSQL
```

Control bắt buộc: HTTPS, hash mật khẩu (argon2/bcrypt), access token ngắn hạn, refresh token xoay vòng có thể thu hồi, validate input, CORS theo whitelist, cookie `HttpOnly; Secure; SameSite`, query tham số hoá (Prisma), chữ ký webhook, audit log, secret ngoài source code.

## 2. Xác thực Khách hàng

| Luồng                            | Quy tắc                                                                                                                                                                                                                         | Nguồn                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Đăng ký email + mật khẩu         | Bắt buộc tick đồng ý dữ liệu (không tick sẵn). Mọi request hợp lệ về định dạng trả **cùng một phản hồi**, không lộ email đã tồn tại; email đã có Tài khoản đã xác thực hoặc Tài khoản nội bộ thì gửi thư cảnh báo cho chủ email | US-501, CMP-01/02     |
| Xác thực email                   | Token một lần, lưu dạng hash. Xác thực xong thì gắn các đơn vãng lai cùng email (không phân biệt hoa thường)                                                                                                                    | US-501 AC3, BR-ORD-08 |
| Đăng nhập Google                 | Email mới → tạo Tài khoản (email coi như đã xác thực). Email đã có Tài khoản → liên kết; nếu Tài khoản đó chưa xác thực thì **xoá mật khẩu cũ và thu hồi mọi phiên**                                                            | US-502 AC1–2          |
| Đăng nhập sai                    | Sai nhiều lần liên tiếp thì tạm khoá đăng nhập theo tài khoản                                                                                                                                                                   | US-502 AC3            |
| Quên mật khẩu                    | Luôn trả "Nếu email tồn tại…". Link dùng một lần, hết hạn **1 giờ**. Đặt lại thành công thì thu hồi mọi phiên                                                                                                                   | US-503                |
| Tài khoản nội bộ trên storefront | Bị từ chối, kể cả qua Google, với thông báo lỗi chung; email/mật khẩu: storefront từ chối theo `role` trả về, server chặn thao tác mua hàng bằng `@Roles` (ADR 0005); Google: server từ chối                                    | US-502 AC4            |

**Token:** access token JWT ngắn hạn (khoảng 15 phút); refresh token ngẫu nhiên, chỉ lưu hash, xoay vòng mỗi lần dùng; dùng lại một refresh token đã xoay thì thu hồi cả chuỗi (phát hiện token bị lộ). Mỗi thiết bị một phiên.

## 3. Vai trò và phân quyền

Bốn vai trò `GUEST`, `CUSTOMER`, `STAFF`, `ADMIN` (ADR 0005). Tài khoản nội bộ có đúng một vai trò `STAFF` hoặc `ADMIN`; `ADMIN` có mọi quyền của `STAFF`. Tài khoản Admin chỉ tạo bằng CLI `npm run cli -- create-admin` (entrypoint riêng `src/cli.ts`, nest-commander, không mở qua HTTP — xem [modules/identity.md](./modules/identity.md) §5.4); trên back-office Admin chỉ quản lý Tài khoản Staff.

- Mỗi route back-office khai báo **tường minh** Quyền cần có (`@Authorize(Permission.CATALOG_PRODUCT_VIEW)`, `src/security/authorization/permissions/`); Tài khoản phải có **mọi** Quyền khai báo. Quyền nằm trong access token (`roles[]`, `permissions[]`, tính lúc login/refresh từ `UserRole` → `RolePermission`; Vai trò `Admin` = toàn bộ enum trong code), không đọc DB mỗi request. Route chỉ cho một loại tài khoản (Khách hàng) dùng `@AuthorizeAccountType` (`src/security/authorization/account-type/`).
- Guard thứ tự: `AuthGuard` (401) → `PermissionsGuard` (403) → kiểm tra sở hữu tài nguyên trong service (đơn của chính mình).
- Ma trận quyền chi tiết: [business/02 §3](../business/02-actors-permissions.md).

## 4. Phiên truy cập đơn của Khách vãng lai

Theo ADR 0011:

- Giỏ vãng lai gắn cookie ngẫu nhiên (chỉ lưu hash ở server), hết hạn sau 30 ngày không hoạt động.
- Đặt đơn xong, server cấp một **phiên truy cập đơn** 30 phút gắn với đúng Mã đơn đó (cookie `HttpOnly`).
- Tra cứu bằng **Mã đơn + số điện thoại** khớp nhau cấp một phiên mới 30 phút. Sai bất kỳ trường nào → "Không tìm thấy đơn", không phân biệt nguyên nhân (US-401 AC2).
- Phiên vãng lai chỉ cho phép xem, thanh toán và huỷ đúng đơn đó.

## 5. Vô hiệu hoá Staff và thu hồi phiên

Vô hiệu hoá Tài khoản Staff, đổi mật khẩu, hoặc liên kết Google thu hồi mật khẩu đều làm **mọi phiên mất hiệu lực ngay** ([business/02 §4](../business/02-actors-permissions.md)):

- Mỗi User có `session_version`; access token mang version lúc cấp.
- Request có xác thực so version trong token với giá trị hiện tại (cache ngắn trong Redis, nguồn là PostgreSQL). Lệch → 401.
- Với route back-office, không xác minh được version (Redis và DB lỗi) thì **fail closed**.
- Đồng thời thu hồi toàn bộ refresh token của User.

## 6. Audit log

- Mọi thao tác **ghi** trên back-office lưu: người làm, thời điểm, đối tượng, giá trị trước và sau ([business/02 §4](../business/02-actors-permissions.md)).
- Mọi lượt Staff **xem** dữ liệu cá nhân Người mua (chi tiết Khách hàng, chi tiết Đơn, tìm đơn theo SĐT) được ghi; mở danh sách đơn thì không (CMP-07).
- Audit ghi trong cùng transaction với thay đổi nghiệp vụ; bảng chỉ thêm, không sửa/xoá qua ứng dụng.

## 7. Rate limiting, webhook, secret, dữ liệu cá nhân

**Rate limiting** (Redis, fail closed `503` khi Redis lỗi — [ADR 0008](../adr/0008-redis-outage-degrades-not-unready.md)):

| Endpoint                                 | Khoá giới hạn                         |
| ---------------------------------------- | ------------------------------------- |
| Đăng nhập                                | IP + email                            |
| Đăng ký, quên mật khẩu, gửi lại xác thực | IP + email                            |
| Tra cứu đơn vãng lai                     | **IP** — chống dò mã đơn (US-401 AC3) |
| Tính thử, đặt đơn                        | IP + giỏ                              |

Webhook (VNPay, MoMo, GHN) **không** bị rate limit chung và không cần Redis.

**Webhook:** xác minh chữ ký/HMAC của từng Cổng trước khi đọc nội dung; sai chữ ký → từ chối và ghi cảnh báo. Không bao giờ tin Return URL (BR-PAY-02). Chi tiết: [06-integrations.md](./06-integrations.md).

**Secret:** chỉ đọc qua biến môi trường được validate lúc khởi động; production lấy từ secret manager; không commit `.env`. Khoá webhook, khoá JWT, khoá HMAC log tách riêng và xoay vòng được.

**Dữ liệu cá nhân** ([business/06](../business/06-compliance.md)): không lưu thông tin thẻ/ví; lưu bằng chứng đồng ý (CMP-02); Yêu cầu xoá dữ liệu **ẩn danh** tên, SĐT, email, địa chỉ nhưng giữ dữ liệu kế toán (CMP-05), chạy như job nhiều bước có trạng thái `processing → completed`.

## 8. Logging và dữ liệu cá nhân

- Log có cấu trúc (JSON), kèm `requestId`. Chi tiết logger: [08-observability.md](./08-observability.md).
- **Che PII** trước khi ghi: email, số điện thoại, tên, địa chỉ, token, mật khẩu, header `Authorization`/`Cookie` và payload webhook thanh toán bị mask hoặc loại bỏ bằng một danh sách field tập trung.
- **IP chỉ ghi dạng HMAC** (khoá bí mật riêng) — vẫn so khớp được để điều tra gian lận/rate limit, nhưng không đọc ngược ra IP.
- Log ứng dụng **tự xoá sau 30 ngày** ([business/06 §5](../business/06-compliance.md)). Audit log và bằng chứng đồng ý không phải log ứng dụng và theo thời hạn lưu riêng.
- Chỉ log lỗi 5xx ở mức `error`; lỗi 4xx không log (theo convention error handling).

## 9. As-built inventory — security

Phần trên là chính sách mục tiêu. Mục này chỉ ghi thành phần xác thực/phân quyền dùng chung có trong source ngoài `src/modules/`; các flow nghiệp vụ trong IdentityModule không thuộc phạm vi inventory này. Tên file được kiểm tra trong source hiện tại; test liệt kê là phạm vi có test, không phải kết quả chạy test.

| File                                                                          | Trách nhiệm, ký hiệu chính và phụ thuộc đáng kể                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/security/contracts/jwt-payload.ts`                                       | `JwtPayload`: `sub`, `email`, `role: AccountType`, `roles`, `permissions` và `sessionVersion`; phụ thuộc enum generated `AccountType` cùng `Permission`.                                                                    |
| `src/security/contracts/permission.enum.ts`                                   | `Permission`, `STAFF_ROLE_PERMISSIONS`, `ADMIN_ROLE_PERMISSIONS`; enum chứa nhóm catalog/pricing/administration hiện có, Admin map tới toàn enum. Chú thích code xác nhận chưa có `OPERATIONS_*` vì chưa có route vận hành. |
| `src/security/authentication/current-user.decorator.ts`                       | `CurrentUser` lấy `request.user` và cung cấp nó dưới dạng `JwtPayload` cho handler.                                                                                                                                         |
| `src/security/authentication/jwt-auth.guard.ts`                               | `JwtAuthGuard` là adapter `AuthGuard('jwt')` của Passport; token và claim được xác minh bởi strategy.                                                                                                                       |
| `src/security/authorization/account-type/account-type.guard.ts`               | `AccountTypeGuard` đọc metadata account type qua `Reflector` và chặn actor không thuộc nhóm yêu cầu; đây không phải kiểm tra quyền RBAC.                                                                                    |
| `src/security/authorization/account-type/authorize-account-type.decorator.ts` | `RequireAccountTypes` giữ metadata loại tài khoản; `AuthorizeAccountType()` ghép `JwtAuthGuard`, `AccountTypeGuard` và Swagger bearer cho route.                                                                            |
| `src/security/authorization/permissions/permissions.decorator.ts`             | `RequirePermissions` lưu danh sách quyền cần thiết làm metadata cho guard.                                                                                                                                                  |
| `src/security/authorization/permissions/permissions.guard.ts`                 | `PermissionsGuard` yêu cầu mọi quyền khai báo phải có trong JWT; phụ thuộc `JwtPayload`, `Permission` và Nest `Reflector`.                                                                                                  |
| `src/security/authorization/permissions/authorize.decorator.ts`               | `Authorize()` ghép JWT và permissions guards, cho phép metadata method ghi đè class và loại guard/bearer metadata lặp; dùng Nest metadata và Swagger.                                                                       |
| `src/security/authorization/ownership/owned-resource.decorator.ts`            | `OwnedResourceOptions` khai báo route param và callback `fetch(id, prisma)`; decorator đặt metadata cho guard.                                                                                                              |
| `src/security/authorization/ownership/ownership.guard.ts`                     | `OwnershipGuard` trả 404 khi thiếu resource, 403 khi sai chủ, cho phép đúng chủ và bỏ qua kiểm tra với `ADMIN`; phụ thuộc `PrismaService`, `Reflector`, `JwtPayload`. Không khẳng định mọi route đã wire guard này.         |
| `src/common/validation/is-strong-password.decorator.ts`                       | `IsStrongPassword()` định nghĩa policy mật khẩu được CLI và env validator tái sử dụng.                                                                                                                                      |
| `src/config/env.validation.ts`                                                | `validate()` yêu cầu `DATABASE_URL`, JWT secret tối thiểu 32 ký tự, bootstrap email/password và kiểm tra biến optional đang dùng; `ADMIN_BOOTSTRAP_PASSWORD` dùng policy mạnh.                                              |
| `src/cli.ts`                                                                  | CLI entrypoint; phân nhánh lệnh mà không khởi động HTTP server.                                                                                                                                                             |
| `src/cli/cli.module.ts`                                                       | `CliModule` wiring cấu hình, Prisma và `IdentityModule` cho command context.                                                                                                                                                |
| `src/cli/create-admin.command.ts`                                             | `CreateAdminCommand` validate input, gọi `InternalAccountService.create()` để tạo ADMIN với actor hệ thống.                                                                                                                 |
| `src/cli/password-prompt.ts`                                                  | `PasswordPrompt` đọc/xác nhận password không echo ra terminal.                                                                                                                                                              |
| `src/infrastructure/mail/mail.module.ts`                                      | `MailModule` đăng ký và export `MailService`.                                                                                                                                                                               |
| `src/infrastructure/mail/mail.service.ts`                                     | `MailService` gửi mã xác minh/link reset qua SMTP khi đủ cấu hình; nếu không có SMTP log thông báo dev do caller cung cấp, không log raw code/token. Phụ thuộc nodemailer/ConfigService.                                    |
| `src/app.module.ts`                                                           | Cài `ThrottlerModule` + `ThrottlerGuard` toàn cục với 20 request/phút và `AllExceptionsFilter`; đây là throttling tại app, không phải bằng chứng cho Redis-backed rate limiting.                                            |

Unit specs cross-cutting về security:

| File                                                                 | Phạm vi kiểm tra                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/security/authorization/permissions/authorize.decorator.spec.ts` | Guard metadata, class/method override, bearer metadata và loại bỏ guard/bearer lặp.       |
| `src/security/authorization/permissions/permissions.guard.spec.ts`   | Metadata lookup, user thiếu, thiếu quyền và yêu cầu đủ mọi quyền.                         |
| `src/security/authorization/ownership/ownership.guard.spec.ts`       | Metadata vắng mặt, user thiếu, ADMIN bypass, resource không tồn tại, sai chủ và đúng chủ. |

E2E system/shared của runtime được liệt kê tại [02-modules.md §5.3](./02-modules.md#53-test-và-repository-entrypoints-liên-quan). E2E auth và CLI tạo tài khoản thuộc phạm vi identity; không lặp tại inventory cross-cutting này.

### 9.1 Target-only hoặc chưa được chứng minh ở phạm vi này

- Redis fail-closed, cache `session_version`, IP HMAC, mask PII tập trung, webhook signature verification, Google OAuth và phiên vãng lai là yêu cầu/thiết kế mục tiêu; không có bằng chứng triển khai tương ứng trong các file shared/security đã kiểm kê. Không kết luận về code trong `src/modules/` vì phần đó nằm ngoài phạm vi được giao.
- `OwnedResource`/`OwnershipGuard` là building blocks có code và unit spec; không có căn cứ trong inventory này để khẳng định route nghiệp vụ nào đang áp dụng chúng.
- Sổ địa chỉ thuộc module `customer` trong target architecture. Source/schema/migrations hiện kiểm tra không có address management; không coi `customer_addresses` trong schema mục tiêu là bảng đang triển khai.
