# 03 — Verify Email (`POST /auth/verify-email`)

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [02-register.md](./02-register.md) — đã có user + `EmailVerificationToken` được tạo lúc register. Cần tra thuật ngữ thì mở [GLOSSARY.md](./GLOSSARY.md); cần nhắc lại quyết định thiết kế thì xem [00-overview.md](./00-overview.md).

Endpoint này xác thực email bằng token nhận qua link trong mail, rồi cập nhật `User.emailVerifiedAt`. Chia thành 4 bước nhỏ.

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
    description: 'Raw token lấy từ link trong email verification',
  })
  @IsString()
  token: string;
}
```

File này chưa gọi được route nào — chỉ cần build không lỗi là xong bước này.

---

## Bước 2 — Tạo DTO response dùng chung (MessageResponseDto)

Nhiều endpoint sau này (verify-email, resend-verification, forgot-password, reset-password, logout, logout-all) đều chỉ cần trả về `{ message: string }` — không có lý do gì để định nghĩa 6 class giống hệt nhau, xem bảng Response DTO ở [00-overview.md § 6](./00-overview.md).

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

export class MessageResponseDto {
  @ApiProperty()
  message: string;
}
```

Đây là DTO dùng chung — chỉ cần viết đúng 1 lần ở đây, các file sau (04-resend-verification.md, 09-logout.md, 10-forgot-password.md, 11-reset-password.md) sẽ import lại, không tạo trùng.

---

## Bước 3 — Xác thực token trong AuthService

Đây là phần logic chính: hash token client gửi lên, tìm đúng `EmailVerificationToken` khớp, kiểm tra hết hạn/đã dùng chưa, rồi cập nhật `User.emailVerifiedAt` trong 1 transaction.

> 📘 **Khái niệm — vì sao lại `hash(rawToken)` rồi mới tìm trong DB, không tìm thẳng bằng raw token?** DB không lưu raw token (xem 01-setup.md, phần TokenService đầy đủ) — chỉ lưu `tokenHash`. Vì vậy để tra cứu, phải hash lại token nhận được từ client bằng đúng thuật toán đã dùng lúc tạo (`TokenService.hashRawToken()`), rồi `findUnique` theo `tokenHash` đó.
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
    throw new NotFoundException('Token không tồn tại');
  }
  if (record.verifiedAt) {
    // Replay protection: token đã dùng rồi, gọi lại lần 2 phải bị reject
    // (không phải hành vi idempotent).
    throw new BadRequestException('Token đã được sử dụng');
  }
  if (record.expiresAt < new Date()) {
    throw new BadRequestException('Token đã hết hạn');
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

  return { message: 'Email đã được xác thực' };
}
```

⚠️ Tên field (`emailVerificationToken`, `tokenHash`, `verifiedAt`, `expiresAt`, `userId`, `emailVerifiedAt`) phải khớp `prisma/schema.prisma` — đối chiếu trước khi paste.

Để ý cách dùng `this.prisma.$transaction([...])` (mảng các Promise) ở đây khác với `this.prisma.$transaction(async (tx) => {...})` đã dùng ở 02-register.md — đây là **dạng transaction đơn giản hơn**, phù hợp khi không cần đọc dữ liệu giữa các bước, dùng cho 2 update độc lập không phụ thuộc kết quả của nhau.

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

Gọi thử qua Postman/curl để tự xác nhận toàn bộ flow (Bước 1 → 4): token hợp lệ verify thành công, gọi lại lần 2 nhận lỗi đã verified; token không tồn tại nhận 400/404; token hết hạn nhận 400. Khi viết test chính thức ở [13-testing.md](./13-testing.md), nhớ cover đủ 4 case trên — đặc biệt case "verify token đã dùng rồi" (replay protection: gọi lại lần 2 với token đã verified phải bị reject, không phải hành vi idempotent) hay bị bỏ sót nhất.

---

➡️ Tiếp theo: [04-resend-verification.md](./04-resend-verification.md)
