# 03 — Verify Email (`POST /auth/verify-email`)

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [02-register.md](./02-register.md) — đã có user + `EmailVerificationToken` được tạo lúc register. Cần tra thuật ngữ thì mở [GLOSSARY.md](./GLOSSARY.md); cần nhắc lại quyết định thiết kế thì xem [00-overview.md](./00-overview.md).

Endpoint này xác thực email bằng token nhận qua link trong mail, rồi cập nhật `User.emailVerifiedAt`. Chia thành 4 bước nhỏ.

## Tổng quan luồng

```
Client → POST /auth/verify-email { token: "<raw token from email link>" }
                │
                ▼
       AuthController.verifyEmail(dto)
                │
                ▼
       AuthService.verifyEmail(dto)
         1. hash(rawToken) → tokenHash
         2. tìm EmailVerificationToken theo tokenHash
         3. kiểm tra: không tồn tại? đã dùng? hết hạn?
         4. transaction: User.emailVerifiedAt = now
                        + Token.verifiedAt = now
                │
                ▼
       { message: "Email verified successfully" }
```

4 bước dưới đây chỉ là 4 file/phần cần tạo để dựng luồng này: DTO input → DTO output dùng chung → logic ở service → route ở controller.

---

## Bước 1 — Mô tả dữ liệu client gửi lên (VerifyEmailDto)

Client chỉ cần gửi lên đúng 1 thứ: raw token lấy từ link trong email. Tạo file `src/auth/dto/verify-email.dto.ts`:

```powershell
New-Item src/auth/dto/verify-email.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/verify-email.dto.ts   # Bash (Git Bash/WSL)
```

```ts
// src/auth/dto/verify-email.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Raw token received from the email verification link',
  })
  @IsString()
  token: string;
}
```

**Vì sao code như vậy:**

- Chỉ có 1 field `token` vì client không cần gửi thêm gì khác — token tự nó định danh được user (DB tra ra `userId` từ token). Đây là pattern chuẩn của "magic link": 1 giá trị bí mật thay cho việc phải định danh user tường minh.
- `@IsString()` để `ValidationPipe` (global) tự chặn request nếu `token` thiếu hoặc sai kiểu, không cần viết `if` thủ công trong service.
- `@ApiProperty()` để field này hiện lên trong Swagger doc.

File này chưa gọi được route nào — chỉ cần build không lỗi là xong bước này.

---

## Bước 2 — Tạo DTO response dùng chung (MessageResponseDto)

Nhiều endpoint sau này (verify-email, resend-verification, forgot-password, reset-password, logout, logout-all) đều chỉ cần trả về `{ message: string }` — không có lý do gì để định nghĩa 6 class giống hệt nhau, xem bảng Response DTO ở [00-overview.md § 5](./00-overview.md).

> 📘 **Khái niệm — vì sao tạo 1 DTO dùng chung thay vì mỗi endpoint tự định nghĩa response riêng?** 6 endpoint khác nhau đều chỉ cần trả `{ message: string }` — không có lý do định nghĩa 6 class giống hệt nhau. Tạo 1 lần, tái sử dụng ở mọi Controller cần.

Tạo file `src/auth/dto/message-response.dto.ts`:

```powershell
New-Item src/auth/dto/message-response.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/message-response.dto.ts   # Bash (Git Bash/WSL)
```

```ts
// src/auth/dto/message-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

// Response dùng chung: nhiều endpoint (verify-email, logout, ...) chỉ cần
// trả về { message: "..." }, nên viết 1 class này để dùng lại thay vì
// mỗi endpoint tự tạo 1 class giống hệt nhau.
export class MessageResponseDto {
  @ApiProperty() // để Swagger UI hiển thị field này trong doc API
  message: string;
}
```

**Vì sao code như vậy:**

- Không có decorator validate (`@IsString()`...) vì đây là **response DTO** (dữ liệu server tự tạo ra), khác với **input DTO** như `VerifyEmailDto` (dữ liệu client gửi lên, cần validate).
- Dùng thực tế: hàm nào trả về `{ message: 'abc' }` là tự động khớp với DTO này nhờ structural typing của TypeScript, không cần `new MessageResponseDto()`.

Đây là DTO dùng chung — chỉ cần viết đúng 1 lần ở đây, các file sau (04-resend-verification.md, 09-logout.md, 10-forgot-password.md, 11-reset-password.md) sẽ import lại, không tạo trùng.

---

## Bước 3 — Xác thực token trong AuthService

Đây là phần logic chính: hash token client gửi lên, tìm đúng `EmailVerificationToken` khớp, kiểm tra hết hạn/đã dùng chưa, rồi cập nhật `User.emailVerifiedAt` trong 1 transaction.

> 📘 **Khái niệm — vì sao lại `hash(rawToken)` rồi mới tìm trong DB, không tìm thẳng bằng raw token?** DB không lưu raw token (xem 01-setup.md, phần TokenService đầy đủ) — chỉ lưu `tokenHash`. Vì vậy để tra cứu, phải hash lại token nhận được từ client bằng đúng thuật toán đã dùng lúc tạo (`TokenService.hashRawToken()`), rồi `findUnique` theo `tokenHash` đó. Đây là nguyên tắc bảo mật giống hệt cách lưu password: nếu DB bị lộ (dump), kẻ tấn công không thể dùng trực tiếp giá trị trong cột `tokenHash` để giả làm token hợp lệ.
>
> 📘 **Khái niệm — vì sao update `User` + `token.verifiedAt` phải chung 1 transaction?** Nếu update `User.emailVerifiedAt` thành công nhưng update `token.verifiedAt` thất bại (crash giữa chừng), token đó vẫn còn "chưa dùng" và có thể bị verify lại lần 2 — vi phạm rule "gọi lại lần 2 phải bị reject". Transaction đảm bảo cả 2 thay đổi cùng xảy ra hoặc cùng không xảy ra.

Mở `src/auth/services/auth.service.ts` (đã có từ 02-register.md) và thêm method mới:

```ts
// src/auth/services/auth.service.ts (thêm vào class AuthService đã có)
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VerifyEmailDto } from '../dto/verify-email.dto';

// ... trong class AuthService, cạnh register()

async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
  const tokenHash = this.tokenService.hashRawToken(dto.token);

  const record = await this.prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });

  if (!record) {
    throw new NotFoundException('Token not found');
  }
  if (record.verifiedAt) {
    // Replay protection: token đã dùng rồi, gọi lại lần 2 phải bị reject
    // (không phải hành vi idempotent).
    throw new BadRequestException('Token already used');
  }
  if (record.expiresAt < new Date()) {
    throw new BadRequestException('Token has expired');
  }

  await this.prisma.$transaction([
    this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    this.prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { verifiedAt: new Date() },
    }),
  ]);

  return { message: 'Email verified successfully' };
}
```

⚠️ Tên field (`emailVerificationToken`, `tokenHash`, `verifiedAt`, `expiresAt`, `userId`, `emailVerifiedAt`) phải khớp `prisma/schema.prisma` — đối chiếu trước khi paste. Model `EmailVerificationToken` hiện tại (`prisma/schema.prisma`):

```prisma
model EmailVerificationToken {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  tokenHash  String    @unique @map("token_hash")
  expiresAt  DateTime  @map("expires_at") @db.Timestamptz(6)
  verifiedAt DateTime? @map("verified_at") @db.Timestamptz(6)
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("email_verification_tokens")
}
```

**Vì sao code như vậy — từng phần theo đúng thứ tự chạy:**

| Phần code                                                      | Việc làm                      | Vì sao                                                                                           |
| -------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `hashRawToken(dto.token)`                                      | Hash lại token client gửi lên | DB không lưu raw token, chỉ lưu `tokenHash` — muốn tra cứu phải hash lại đúng thuật toán lúc tạo |
| `findUnique({ where: { tokenHash } })`                         | Tìm record theo hash          | `tokenHash` là unique constraint, tối đa 1 kết quả khớp                                          |
| `if (!record) throw NotFoundException`                         | Token không tồn tại → 404     | Token sai/bịa ra, tài nguyên không có thật                                                       |
| `if (record.verifiedAt) throw BadRequestException`             | Token đã dùng rồi → 400       | **Replay protection**: chặn gọi lại lần 2 với cùng token, không cho hành vi idempotent im lặng   |
| `if (record.expiresAt < new Date()) throw BadRequestException` | Token hết hạn → 400           | Giới hạn 24h tuổi token (set lúc tạo ở register)                                                 |
| `$transaction([update User, update Token])`                    | Cập nhật 2 bảng cùng lúc      | Đảm bảo 2 thay đổi cùng xảy ra hoặc cùng không (atomicity) — xem khái niệm ở trên                |

Để ý cách dùng `this.prisma.$transaction([...])` (mảng các Promise) ở đây khác với `this.prisma.$transaction(async (tx) => {...})` đã dùng ở 02-register.md — đây là **dạng transaction đơn giản hơn**, phù hợp khi không cần đọc dữ liệu giữa các bước, dùng cho 2 update độc lập không phụ thuộc kết quả của nhau. Ở `verifyEmail`, cả 2 update đều đã biết sẵn `record.userId` và `record.id` từ bước tìm kiếm phía trên, không cần đọc gì mới giữa 2 update. Ngược lại, `register()` phải tạo `User` xong mới lấy được `user.id` để tạo `EmailVerificationToken`, nên bắt buộc dùng dạng callback `(tx) => ...`.

Thử nghiệm: gọi `verifyEmail` với token hợp lệ phải thành công, gọi lại lần 2 với đúng token đó phải nhận `BadRequestException` (đã verified) chứ không phải hành vi idempotent im lặng. Token không tồn tại → `NotFoundException`. Token hết hạn → `BadRequestException`.

---

## Bước 4 — Mở endpoint HTTP

Bước cuối, expose route `POST /auth/verify-email`:

```ts
// src/auth/auth.controller.ts (thêm vào class AuthController đã có ở 02-register.md)
import { VerifyEmailDto } from './dto/verify-email.dto';
import { MessageResponseDto } from './dto/message-response.dto';

// ... trong class AuthController, cạnh register()

@Post('verify-email')
@HttpCode(HttpStatus.OK)
async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponseDto> {
  return this.authService.verifyEmail(dto);
}
```

**Vì sao code như vậy:**

- `@Post('verify-email')` mở route `POST /auth/verify-email`.
- `@HttpCode(HttpStatus.OK)` ép trả về 200 thay vì mặc định 201 mà NestJS tự gán cho mọi `@Post` — vì verify-email không tạo resource mới, 200 mới đúng nghĩa REST.
- `@Body() dto: VerifyEmailDto` — NestJS tự parse JSON body + chạy `ValidationPipe` trên `VerifyEmailDto` trước khi vào hàm.
- Controller không xử lý logic gì, chỉ forward `dto` xuống `authService.verifyEmail(dto)` — giữ đúng nguyên tắc controller mỏng, logic nghiệp vụ nằm ở service.

Gọi thử qua Postman/curl để tự xác nhận toàn bộ flow (Bước 1 → 4): token hợp lệ verify thành công, gọi lại lần 2 nhận lỗi đã verified; token không tồn tại nhận 400/404; token hết hạn nhận 400. Khi viết test chính thức ở [13-testing.md](./13-testing.md), nhớ cover đủ 4 case trên — đặc biệt case "verify token đã dùng rồi" (replay protection: gọi lại lần 2 với token đã verified phải bị reject, không phải hành vi idempotent) hay bị bỏ sót nhất.

### Trace nhanh 1 request thực tế

Giả sử body gửi lên: `{ "token": "a3f9...c21" }` (raw token client lấy từ link email, được tạo lúc `register()` — xem `01-setup.md` phần `TokenService`).

1. `ValidationPipe` validate `dto = { token: "a3f9...c21" }` → vào tới Controller.
2. Controller forward `dto` xuống `authService.verifyEmail(dto)`.
3. Service hash lại `"a3f9...c21"` → ra đúng `tokenHash` đã lưu trong DB lúc register (cùng thuật toán, cùng input).
4. `findUnique` tìm ra `record` (giả sử còn hạn, chưa verify) → qua cả 3 check.
5. Transaction update `User.emailVerifiedAt` + `Token.verifiedAt` cùng lúc.
6. Trả `{ message: 'Email verified successfully' }` → Controller trả HTTP 200.

Nếu gọi lại lần 2 với đúng token: `findUnique` vẫn tìm ra `record` (token không bị xoá, chỉ bị đánh dấu), nhưng `record.verifiedAt` giờ đã có giá trị → rơi vào nhánh `BadRequestException('Token already used')` ngay, không chạm transaction nữa.

---

➡️ Tiếp theo: [04-resend-verification.md](./04-resend-verification.md)
