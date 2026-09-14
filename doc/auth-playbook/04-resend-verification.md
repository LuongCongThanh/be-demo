# 04 — Resend Verification (`POST /auth/resend-verification`)

> ⬅️ Trước khi làm file này: xong [03-verify-email.md](./03-verify-email.md) (`MessageResponseDto` đã tồn tại, `TokenService.createEmailVerificationToken()` đã có).
> 📚 Tham chiếu chung (Decisions, Security Rules, Response DTO...): [00-overview.md](./00-overview.md).

**Goal:** Cho phép gửi lại email verification mà **không lộ thông tin email có tồn tại hay không** (quyết định #10).

---

## STEP 9.1 — ResendVerificationDto — 🔴 Chưa làm

**Goal:** Định nghĩa dữ liệu client gửi lên (chỉ cần email).

**Files:** `src/auth/dto/resend-verification.dto.ts`

**CLI:**

```powershell
New-Item src/auth/dto/resend-verification.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/resend-verification.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

```ts
// src/auth/dto/resend-verification.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}
```

**Acceptance Criteria:**

- [ ] File compile được.

---

## STEP 9.2 — AuthService.resendVerification() — 🔴 Chưa làm

**Goal:** Tìm user theo email; dù tồn tại hay không, dù đã verify hay chưa — **luôn trả về đúng cùng 1 message**, chỉ khác nhau ở việc có tạo token mới + gửi mail hay không (client không phân biệt được).

**Files:** `src/auth/services/auth.service.ts` (thêm method mới)

**Implementation:**

> 📘 **Khái niệm — "email enumeration" là gì, vì sao phải giấu?** Nếu response khác nhau tuỳ email tồn tại hay không (vd "Email không tồn tại" vs "Đã gửi lại email"), kẻ tấn công có thể dò ra **danh sách email đã đăng ký** bằng cách thử hàng loạt địa chỉ và quan sát response khác nhau — gọi là "user enumeration". Với `resend-verification` (khác với `register`, xem quyết định #10), ta chọn **luôn trả cùng 1 response** bất kể nhánh xử lý bên trong khác nhau thế nào.

```ts
// src/auth/services/auth.service.ts (thêm vào class AuthService đã có)
import { ResendVerificationDto } from '../dto/resend-verification.dto';

// ... trong class AuthService

private static readonly GENERIC_RESEND_MESSAGE =
  'Nếu email tồn tại và chưa xác thực, một email xác thực mới đã được gửi.';

async resendVerification(
  dto: ResendVerificationDto,
): Promise<{ message: string }> {
  const user = await this.prisma.user.findUnique({
    where: { email: dto.email },
  });

  // Email không tồn tại HOẶC đã verified rồi → vẫn trả cùng message chung
  // chung, KHÔNG tạo token mới, KHÔNG gửi mail — nhưng response giống hệt
  // case hợp lệ để không lộ enumeration.
  if (!user || user.emailVerifiedAt) {
    return { message: AuthService.GENERIC_RESEND_MESSAGE };
  }

  // Email tồn tại & chưa verify → tạo token mới (xoá token cũ trước, quyết
  // định #8, đã xử lý sẵn trong TokenService) → gửi mail SAU khi token đã
  // lưu DB xong (không cần transaction ở đây vì chỉ có 1 write).
  const rawToken = await this.tokenService.createEmailVerificationToken(
    user.id,
  );

  try {
    await this.mailService.sendVerificationEmail(user.email, rawToken);
  } catch (err) {
    this.logger.error(
      `Gửi lại verification email thất bại cho ${user.email}`,
      err as Error,
    );
    // Không throw lại — vẫn trả message chung chung như case thành công,
    // user có thể tự thử resend lại lần nữa.
  }

  return { message: AuthService.GENERIC_RESEND_MESSAGE };
}
```

> ⚠️ Method này dùng `this.tokenService.createEmailVerificationToken()` (đã viết đầy đủ ở [01-setup.md § STEP 7](./01-setup.md)) — khác với `AuthService.register()` ([02-register.md](./02-register.md) STEP 5.5) phải tự viết `createVerificationTokenInTx` vì cần chung transaction. Ở đây không cần transaction (chỉ 1 write), nên gọi thẳng qua `TokenService` bình thường.

**Acceptance Criteria:**

- [ ] Gọi với email tồn tại & chưa verify → trả `GENERIC_RESEND_MESSAGE`, tạo token mới, gọi `sendVerificationEmail`.
- [ ] Gọi với email đã verified → trả **cùng** `GENERIC_RESEND_MESSAGE`, không tạo token, không gọi mail.
- [ ] Gọi với email không tồn tại → trả **cùng** `GENERIC_RESEND_MESSAGE`, không tạo token, không gọi mail.
- [ ] 3 case trên trả về response **giống hệt nhau về status code + message** — viết test so sánh trực tiếp, không chỉ đọc bằng mắt.

---

## STEP 9.3 — AuthController (`POST /auth/resend-verification`) — 🔴 Chưa làm

**Goal:** Expose HTTP endpoint.

**Files:** `src/auth/auth.controller.ts` (thêm route mới)

**Implementation:**

```ts
// src/auth/auth.controller.ts (thêm import + route vào class AuthController đã có)
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { MessageResponseDto } from './dto/message-response.dto'; // đã tạo ở 03-verify-email.md STEP 8.2

// ... trong class AuthController

@Post('resend-verification')
@HttpCode(HttpStatus.OK)
async resendVerification(
  @Body() dto: ResendVerificationDto,
): Promise<MessageResponseDto> {
  return this.authService.resendVerification(dto);
}
```

**Acceptance Criteria (toàn bộ flow — verify sau khi xong 9.1→9.3):**

- [ ] Response luôn cùng 1 dạng message/status bất kể email tồn tại hay không.
- [ ] Email tồn tại & chưa verify → token mới được tạo, email được gửi.
- [ ] Email đã verified → không tạo token mới, response vẫn giống case hợp lệ.

**Tests:**

- resend với email tồn tại & chưa verify.
- resend với email đã verified.
- resend với email không tồn tại → response không phân biệt được với case hợp lệ.

---

➡️ Tiếp theo: [05-login.md](./05-login.md)
