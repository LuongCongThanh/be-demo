# 03 — Verify Email (`POST /auth/verify-email`)

> ⬅️ Trước khi làm file này: xong [02-register.md](./02-register.md) (đã có user + `EmailVerificationToken` được tạo lúc register).
> 📚 Tham chiếu chung (Decisions, Security Rules, Response DTO...): [00-overview.md](./00-overview.md).

**Goal:** Xác thực email bằng token nhận qua link email, cập nhật `User.emailVerifiedAt`.

---

## STEP 8.1 — VerifyEmailDto — 🔴 Chưa làm

**Goal:** Định nghĩa dữ liệu client gửi lên (raw token nhận từ link email).

**Files:** `src/auth/dto/verify-email.dto.ts`

**CLI:**

```powershell
New-Item src/auth/dto/verify-email.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/verify-email.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

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

**Acceptance Criteria:**

- [ ] File compile được, chưa cần route nào gọi tới.

---

## STEP 8.2 — MessageResponseDto (dùng chung) — 🔴 Chưa làm

**Goal:** Tạo DTO response dùng chung cho các endpoint chỉ trả 1 message (verify-email, resend-verification, forgot-password, reset-password, logout, logout-all) — xem bảng Response DTO ở [00-overview.md § 6](./00-overview.md).

**Files:** `src/auth/dto/message-response.dto.ts`

> 📘 **Khái niệm — vì sao tạo 1 DTO dùng chung thay vì mỗi endpoint tự định nghĩa response riêng?** 6 endpoint khác nhau đều chỉ cần trả `{ message: string }` — không có lý do định nghĩa 6 class giống hệt nhau. Tạo 1 lần, tái sử dụng ở mọi Controller cần.

**CLI:**

```powershell
New-Item src/auth/dto/message-response.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/message-response.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

```ts
// src/auth/dto/message-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty()
  message: string;
}
```

**Acceptance Criteria:**

- [ ] File compile được. Đây là DTO dùng chung — chỉ cần viết 1 lần, các file sau (04, 09, 10, 11) import lại, không tạo trùng.

---

## STEP 8.3 — AuthService.verifyEmail() — 🔴 Chưa làm

**Goal:** Hash token nhận được, tìm đúng `EmailVerificationToken`, kiểm tra hết hạn/đã dùng, cập nhật `User.emailVerifiedAt` trong 1 transaction.

**Files:** `src/auth/services/auth.service.ts` (thêm method mới)

**Implementation:**

> 📘 **Khái niệm — vì sao lại `hash(rawToken)` rồi mới tìm trong DB, không tìm thẳng bằng raw token?** DB không lưu raw token (xem [01-setup.md § STEP 7](./01-setup.md)) — chỉ lưu `tokenHash`. Vì vậy để tra cứu, phải hash lại token nhận được từ client bằng đúng thuật toán đã dùng lúc tạo (`TokenService.hashRawToken()`), rồi `findUnique` theo `tokenHash` đó.
>
> 📘 **Khái niệm — vì sao update `User` + `token.verifiedAt` phải chung 1 transaction?** Nếu update `User.emailVerifiedAt` thành công nhưng update `token.verifiedAt` thất bại (crash giữa chừng), token đó vẫn còn "chưa dùng" và có thể bị verify lại lần 2 — vi phạm rule "gọi lại lần 2 phải bị reject". Transaction đảm bảo cả 2 thay đổi cùng xảy ra hoặc cùng không xảy ra.

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

> ⚠️ Tên field (`emailVerificationToken`, `tokenHash`, `verifiedAt`, `expiresAt`, `userId`, `emailVerifiedAt`) phải khớp `prisma/schema.prisma` — đối chiếu trước khi paste.
>
> Cách dùng `this.prisma.$transaction([...])` (mảng các Promise) ở đây khác với `this.prisma.$transaction(async (tx) => {...})` đã dùng ở [02-register.md](./02-register.md) — đây là **dạng transaction đơn giản hơn** dùng khi không cần đọc dữ liệu giữa các bước, phù hợp cho 2 update độc lập không phụ thuộc kết quả của nhau.

**Acceptance Criteria:**

- [ ] Token hợp lệ → verify thành công, gọi lại lần 2 với cùng token → `BadRequestException` (đã verified).
- [ ] Token không tồn tại → `NotFoundException` (404).
- [ ] Token hết hạn → `BadRequestException` (400).

---

## STEP 8.4 — AuthController (`POST /auth/verify-email`) — 🔴 Chưa làm

**Goal:** Expose HTTP endpoint.

**Files:** `src/auth/auth.controller.ts` (thêm route mới)

**Implementation:**

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

**Acceptance Criteria (toàn bộ flow — verify sau khi xong 8.1→8.4):**

- [ ] Token hợp lệ → verify thành công, gọi lại lần 2 → lỗi (đã verified).
- [ ] Token không tồn tại → 400/404.
- [ ] Token hết hạn → 400.

**Tests:**

- verify success.
- token không tồn tại.
- token hết hạn.
- verify token đã dùng rồi (replay protection — gọi lại lần 2 với token đã verified phải bị reject, không phải hành vi idempotent).

---

➡️ Tiếp theo: [04-resend-verification.md](./04-resend-verification.md)
