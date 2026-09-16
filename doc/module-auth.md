Dựa đúng trên schema và convention bạn vừa đưa, phần **Authentication + Authorization + Email Verification** cho web bán hàng có thể tóm lại thành một flow khá rõ như sau.

## 1. Các bảng đã có sẵn để làm Auth

Trong 15 bảng hiện tại, phần auth sử dụng trực tiếp:

```text
users
roles
user_roles
refresh_tokens
password_reset_tokens
email_verification_tokens
```

Quan hệ:

```text
User
 ├── UserRole ──> Role
 ├── RefreshToken
 ├── PasswordResetToken
 └── EmailVerificationToken
```

Vai trò từng bảng:

| Bảng                        | Mục đích                      |
| --------------------------- | ----------------------------- |
| `users`                     | lưu tài khoản                 |
| `roles`                     | CUSTOMER, ADMIN...            |
| `user_roles`                | gán role cho user             |
| `refresh_tokens`            | quản lý refresh token/session |
| `password_reset_tokens`     | forgot/reset password         |
| `email_verification_tokens` | verify email                  |

---

# 2. Role nên có ít nhất

Với ecommerce MVP:

```text
CUSTOMER
ADMIN
```

Có thể seed:

```text
roles

ADMIN
CUSTOMER
```

Sau này mới thêm:

```text
STAFF
MANAGER
WAREHOUSE
SUPPORT
```

nếu nghiệp vụ cần.

---

# 3. Authentication APIs cần làm

Mình sẽ chia module:

```text
src/
├── auth/
│   ├── dto/
│   ├── guards/
│   ├── strategies/
│   ├── decorators/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
│
├── users/
├── roles/
└── prisma/
```

Các API auth MVP:

```text
POST /auth/register

POST /auth/verify-email

POST /auth/resend-verification

POST /auth/login

POST /auth/refresh

POST /auth/logout

POST /auth/forgot-password

POST /auth/reset-password

GET  /auth/me
```

Đây là bộ API cơ bản mình khuyên làm trước.

---

# 4. Register

API:

```http
POST /auth/register
```

Input:

```json
{
  "email": "user@example.com",
  "password": "Password@123",
  "fullName": "Daniel Nguyen",
  "phone": "0901234567"
}
```

Flow:

```text
Request
 ↓
Validate DTO
 ↓
Email đã tồn tại?
 ├── Yes → 409
 └── No
       ↓
Hash password
       ↓
Create User
       ↓
Assign CUSTOMER role
       ↓
Create email verification token
       ↓
Hash token trước khi lưu DB
       ↓
Send verification email
       ↓
Return success
```

Quan trọng:

```text
password
```

không bao giờ lưu trực tiếp.

Database lưu:

```text
passwordHash
```

**Password policy** (áp dụng cho cả Register lẫn Reset Password — mục 17):

```text
Tối thiểu 8 ký tự
Có ít nhất 1 chữ hoa
Có ít nhất 1 chữ thường
Có ít nhất 1 chữ số
Có ít nhất 1 ký tự đặc biệt
```

---

# 5. Password hashing

Nên dùng:

```text
argon2
```

hoặc:

```text
bcrypt
```

Ví dụ mental model:

```text
Password@123
     ↓
argon2.hash()
     ↓
$argon2id$...
     ↓
users.password_hash
```

Login:

```text
password input
     ↓
argon2.verify(hash, password)
```

Không:

```text
decrypt password
```

vì password hashing phải là one-way.

---

# 6. Email Verification

Sau register:

```text
User
status = ACTIVE
emailVerifiedAt = NULL
```

Nhưng tài khoản vẫn:

```text
NOT VERIFIED
```

Bạn nên xác định business rule:

```text
User chưa verify email
→ có được login không?
```

Mình khuyên cho ecommerce:

```text
Register
 ↓
Verify email
 ↓
Login
```

tức là chưa verify thì login bị chặn.

**Lưu ý quan trọng: đây là 2 trục trạng thái độc lập, không được gộp mơ hồ:**

```text
Trục 1 — Account status (User.status)
  ACTIVE | BLOCKED
  → tài khoản có bị khoá (do admin/vi phạm...) hay không

Trục 2 — Email verification (User.emailVerifiedAt)
  NULL | <timestamp>
  → email đã xác thực hay chưa
```

Login cần kiểm tra **cả hai trục**, độc lập với nhau:

```text
status === 'BLOCKED' → chặn, dù email đã verify
emailVerifiedAt === null → chặn, dù account đang ACTIVE
```

Một user có thể ACTIVE nhưng chưa verify email (vừa register xong), hoặc đã verify email nhưng bị BLOCKED sau đó (do vi phạm) — 2 trục này không suy ra lẫn nhau.

---

# 7. Tạo email verification token

Không nên lưu token raw.

Flow:

```text
random token
      ↓
SHA-256
      ↓
tokenHash
      ↓
email_verification_tokens
```

Database:

```text
id
userId
tokenHash
expiresAt
verifiedAt
createdAt
```

Email gửi URL dạng:

```text
https://your-app.com/verify-email?token=<RAW_TOKEN>
```

Raw token:

```text
chỉ user nhận
```

Database:

```text
chỉ giữ hash
```

---

# 8. Verify Email API

```http
POST /auth/verify-email
```

Request:

```json
{
  "token": "..."
}
```

Flow:

```text
Token
 ↓
Hash token
 ↓
Find EmailVerificationToken
 ↓
Exists?
 ↓
Expired?
 ↓
Already verified?
 ↓
Transaction
 ├── update User.emailVerifiedAt
 └── update token.verifiedAt
 ↓
Success
```

Response:

```json
{
  "message": "Email verified successfully"
}
```

---

# 9. Resend Verification Email

```http
POST /auth/resend-verification
```

Input:

```json
{
  "email": "user@example.com"
}
```

Flow:

```text
Find User
 ↓
Already verified?
 ↓
Invalidate / expire old verification tokens
 ↓
Generate new token
 ↓
Store tokenHash
 ↓
Send email
```

Nên có:

```text
rate limit
```

ví dụ:

```text
1 email / 60 seconds
```

để tránh spam email service.

---

# 10. Login

```http
POST /auth/login
```

Input:

```json
{
  "email": "user@example.com",
  "password": "Password@123"
}
```

Flow:

```text
Find user by email
 ↓
User exists?
 ↓
status === ACTIVE?
 ↓
emailVerifiedAt != null?
 ↓
Verify password hash
 ↓
Load roles
 ↓
Generate Access Token
 ↓
Generate Refresh Token
 ↓
Hash Refresh Token
 ↓
Save refresh_tokens
 ↓
Return auth result
```

---

# 11. Access Token

Access token nên sống ngắn.

Ví dụ:

```text
15 minutes
```

Payload có thể gồm:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "roles": ["CUSTOMER"]
}
```

Không nên nhét:

```text
password
passwordHash
refresh token
personal data không cần thiết
```

vào JWT.

---

# 12. Refresh Token

Refresh token dài hơn:

```text
7–30 days
```

Flow:

```text
Random/JWT refresh token
 ↓
Hash
 ↓
refresh_tokens.tokenHash
```

Database còn lưu:

```text
expiresAt
revokedAt
```

Nên cho phép nhiều session:

```text
Laptop
Mobile
Tablet
```

tức một user có:

```text
RefreshToken[]
```

là hợp lý.

---

# 13. Refresh Access Token

API:

```http
POST /auth/refresh
```

Flow:

```text
Refresh Token
 ↓
Hash
 ↓
Find refresh_tokens
 ↓
Exists?
 ↓
Expired?
 ↓
revokedAt == null?
 ↓
User ACTIVE?
 ↓
Generate new Access Token
```

Tốt hơn nữa có thể dùng:

```text
refresh token rotation
```

Flow:

```text
old refresh token
 ↓
revoke
 ↓
new refresh token
 ↓
store new hash
```

Đây là hướng nên dùng.

**Reuse detection:** nếu 1 refresh token đã bị revoke (do đã rotate 1 lần) mà lại bị dùng lại lần nữa, đây là dấu hiệu token đã bị đánh cắp. Xử lý:

```text
Refresh token có revokedAt != null
 ↓
Coi là reuse (bị đánh cắp)
 ↓
Revoke TOÀN BỘ refresh_tokens của user đó
 ↓
Bắt buộc login lại ở mọi thiết bị
```

Giới hạn quan trọng cần biết: reuse detection chỉ thu hồi được **refresh token**. Access token (JWT) đã phát hành trước đó vẫn còn hiệu lực cho tới khi hết TTL (15 phút) — vì đây là stateless token, server không có chỗ nào để "hủy" nó giữa chừng. Access token TTL ngắn chính là cách giảm thiệt hại cho khoảng thời gian này. Muốn thu hồi access token ngay lập tức cần thêm cơ chế denylist hoặc token-version, hiện chưa làm ở MVP này.

---

# 14. Logout

```http
POST /auth/logout
```

Logout không nhất thiết xoá user session toàn bộ.

Chỉ cần:

```text
refresh_tokens.revokedAt = now()
```

Flow:

```text
Current refresh token
 ↓
Find token
 ↓
Revoke
 ↓
Logout successful
```

---

# 15. Logout All Devices

Có thể thêm:

```http
POST /auth/logout-all
```

Flow:

```text
Current User
 ↓
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE user_id = currentUser
AND revoked_at IS NULL
```

Sau đó mọi device phải login lại.

---

# 16. Forgot Password

```http
POST /auth/forgot-password
```

Input:

```json
{
  "email": "user@example.com"
}
```

Flow:

```text
Find user
 ↓
Generate reset token
 ↓
Hash token
 ↓
Store PasswordResetToken
 ↓
Set expiration
 ↓
Send email
```

Security rất quan trọng:

Không nên trả:

```text
"Email không tồn tại"
```

Nên luôn trả dạng:

```text
If the account exists, a reset link has been sent.
```

để tránh email enumeration.

---

# 17. Reset Password

```http
POST /auth/reset-password
```

Input:

```json
{
  "token": "...",
  "password": "NewPassword@123",
  "confirmPassword": "NewPassword@123"
}
```

Flow:

```text
Hash token
 ↓
Find reset token
 ↓
Exists?
 ↓
Expired?
 ↓
usedAt == null?
 ↓
Validate new password (cùng password policy ở mục 4, cộng confirmPassword phải khớp password)
 ↓
Hash new password
 ↓
Transaction
 ├── update user.passwordHash
 ├── token.usedAt = now()
 └── revoke existing refresh tokens
 ↓
Success
```

Sau reset password:

```text
logout all devices
```

là một lựa chọn bảo mật tốt.

---

# 18. GET `/auth/me`

```http
GET /auth/me
```

Header:

```text
Authorization: Bearer <access_token>
```

Flow:

```text
JWT Guard
 ↓
Decode / Verify JWT
 ↓
CurrentUser
 ↓
Find User
 ↓
Response DTO
```

Response:

```json
{
  "id": "...",
  "email": "user@example.com",
  "fullName": "Daniel Nguyen",
  "phone": "...",
  "status": "ACTIVE",
  "emailVerified": true,
  "roles": ["CUSTOMER"]
}
```

Không trả:

```text
passwordHash
refreshTokens
tokenHash
```

---

# 19. Authorization

Sau Authentication mới tới Authorization.

Phân biệt:

```text
Authentication
= Bạn là ai?

Authorization
= Bạn được phép làm gì?
```

Architecture:

```text
Request
 ↓
JwtAuthGuard
 ↓
RolesGuard
 ↓
Controller
 ↓
Service
```

---

# 20. Decorator `@Roles()`

Ví dụ:

```ts
@Roles('ADMIN')
@Post('products')
createProduct() {}
```

Flow:

```text
JWT
 ↓
Current user roles
 ↓
RolesGuard
 ↓
ADMIN?
 ├── No → 403
 └── Yes → Controller
```

---

# 21. CUSTOMER permissions

Customer có thể:

```text
View Products
View Categories

Manage own Cart

Checkout own Cart

View own Orders

Cancel own eligible Order

Update own profile
```

Không được:

```text
Create Product
Update Product
Delete Product

Manage Category

View other users

Manage Roles
```

---

# 22. ADMIN permissions

Admin có thể:

```text
Products CRUD
Categories CRUD

Inventory management

Orders management

User management

Role management
```

Ví dụ:

```text
POST   /products
PATCH  /products/:id
DELETE /products/:id

POST   /categories
PATCH  /categories/:id

PATCH  /inventory/:variantId
```

đều:

```text
ADMIN
```

---

# 23. Role không đủ cho mọi trường hợp

Ví dụ:

```http
GET /orders/:id
```

Customer có role:

```text
CUSTOMER
```

nhưng không có nghĩa customer A được xem order của customer B.

Bạn cần thêm **ownership check**:

```text
JWT User
 ↓
Order.userId
 ↓
Same?
 ├── Yes → allow
 └── No → 403
```

Service:

```text
Role
+
Ownership
+
Business Rules
```

mới tạo thành authorization hoàn chỉnh.

**Implementation thực tế:** ownership check dùng chung 1 guard/decorator duy nhất cho mọi loại resource, thay vì viết tay lặp lại ở từng module:

```text
OwnershipGuard + @OwnedResource(options)
```

`@OwnedResource({ paramIdKey, fetch })` khai báo cách lấy resource theo id trong params và trả về `userId` của resource đó; `OwnershipGuard` so sánh với `request.user.sub`, cho ADMIN bypass check này. Guard chỉ lo phần "có phải chủ resource hay không" — business rule sâu hơn (vd đơn hàng phải ở trạng thái PENDING mới được hủy) vẫn nằm ở Service, không nhét vào Guard.

---

# 24. Module structure mình đề xuất

```text
src/
├── auth/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   │
│   ├── dto/
│   │   ├── register.dto.ts
│   │   ├── login.dto.ts
│   │   ├── verify-email.dto.ts
│   │   ├── resend-verification.dto.ts
│   │   ├── refresh-token.dto.ts
│   │   ├── forgot-password.dto.ts
│   │   └── reset-password.dto.ts
│   │
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   │
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   │
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
│
├── users/
│   ├── dto/
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
│
├── roles/
│
└── prisma/
```

---

# 25. Full authentication flow

Bạn có thể dùng flow này làm flow chuẩn:

```text
                    REGISTER

Client
 ↓
POST /auth/register
 ↓
Validate DTO
 ↓
Check duplicate email
 ↓
Hash password
 ↓
Create User
 ↓
Assign CUSTOMER
 ↓
Generate Verification Token
 ↓
Hash Token → DB
 ↓
Send Email
 ↓
Waiting Verification


                    VERIFY

Email Link
 ↓
POST /auth/verify-email
 ↓
Validate Token
 ↓
Update emailVerifiedAt
 ↓
Mark Token Verified


                     LOGIN

POST /auth/login
 ↓
Check User
 ↓
Check ACTIVE
 ↓
Check Verified Email
 ↓
Verify Password
 ↓
Load Roles
 ↓
Access Token
+
Refresh Token


                 AUTHENTICATED API

Request
 ↓
Access Token
 ↓
JwtAuthGuard
 ↓
Current User
 ↓
RolesGuard / Ownership
 ↓
Controller
 ↓
Service
```

---

# 26. API list cuối cùng cho Auth MVP

Mình sẽ chốt MVP với:

| API                              | Auth          | Chức năng            |
| -------------------------------- | ------------- | -------------------- |
| `POST /auth/register`            | Public        | đăng ký              |
| `POST /auth/verify-email`        | Public        | verify email         |
| `POST /auth/resend-verification` | Public        | gửi lại verify       |
| `POST /auth/login`               | Public        | login                |
| `POST /auth/refresh`             | Refresh token | lấy access token mới |
| `POST /auth/logout`              | Auth          | logout               |
| `POST /auth/logout-all`          | Auth          | logout mọi thiết bị  |
| `POST /auth/forgot-password`     | Public        | yêu cầu reset        |
| `POST /auth/reset-password`      | Public        | đặt password mới     |
| `GET /auth/me`                   | Auth          | current user         |

Authorization infrastructure:

```text
JwtAuthGuard
RolesGuard
@Roles()
@CurrentUser()
ownership validation
```

---

# 27. Thứ tự implementation mình khuyên

Đừng viết tất cả một lúc. Làm theo:

```text
STEP 01
Seed ADMIN + CUSTOMER roles

STEP 02
Register

STEP 03
Email verification

STEP 04
Resend email verification

STEP 05
Login

STEP 06
JWT access token

STEP 07
Refresh token + rotation

STEP 08
JwtAuthGuard

STEP 09
@CurrentUser

STEP 10
RolesGuard + @Roles

STEP 11
/auth/me

STEP 12
Logout

STEP 13
Logout all devices

STEP 14
Forgot password

STEP 15
Reset password

STEP 16
Rate limiting

STEP 17
Unit + E2E tests

STEP 18
Swagger / OpenAPI
```

Sau khi hoàn thành flow trên, bạn mới bắt đầu bảo vệ các module ecommerce:

```text
Products
Categories
Cart
Orders
Inventory
```

theo:

```text
authentication
+
role
+
ownership
+
business rule
```

Đó là phạm vi hợp lý cho **Authentication & Authorization MVP của web bán hàng dựa trên đúng schema hiện tại của bạn**.

---

# 28. Admin Bootstrap

Không có API HTTP nào tạo tài khoản ADMIN — cố ý, để giảm bề mặt tấn công (không ai gọi được endpoint đó từ bên ngoài, dù có exploit gì đi nữa).

Thay vào đó, tài khoản ADMIN đầu tiên được tạo bằng **seed script**, chạy 1 lần lúc setup:

```text
Seed script
 ↓
Đọc ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD từ env
 ↓
Hash password
 ↓
Tạo User + gán role ADMIN
```

Muốn thêm ADMIN khác sau này, dùng chính tài khoản ADMIN đã có để quản lý user (qua 1 API riêng dành cho ADMIN, ngoài phạm vi auth MVP này), không phải chạy lại seed script.
