# 04 — Resend Verification (`POST /auth/resend-verification`)

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [03-verify-email.md](./03-verify-email.md) — `MessageResponseDto` đã tồn tại, `TokenService.createEmailVerificationToken()` đã có. Cần tra thuật ngữ thì mở [GLOSSARY.md](./GLOSSARY.md); cần nhắc lại quyết định thiết kế thì xem [00-overview.md](./00-overview.md).

Endpoint này cho phép gửi lại email verification mà **không lộ thông tin email có tồn tại hay không** (quyết định #10). Chia thành 3 bước.

---

## Bước 1 — Mô tả dữ liệu client gửi lên (ResendVerificationDto)

Client chỉ cần gửi đúng 1 field: email. Tạo file `src/auth/dto/resend-verification.dto.ts`:

```powershell
New-Item src/auth/dto/resend-verification.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/resend-verification.dto.ts   # Bash (Git Bash/WSL)
```

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

File này chỉ cần build không lỗi là xong.

---

## Bước 2 — Viết logic không lộ enumeration trong AuthService

Đây là phần tinh tế nhất của endpoint này: dù email tồn tại hay không, dù đã verify hay chưa — bạn phải **luôn trả về đúng cùng 1 message**, chỉ khác nhau ở việc có tạo token mới + gửi mail hay không phía sau hậu trường (client không được phép phân biệt được 2 trường hợp này qua response).

> 📘 **Khái niệm — "email enumeration" là gì, vì sao phải giấu?** Nếu response khác nhau tuỳ email tồn tại hay không (vd "Email không tồn tại" vs "Đã gửi lại email"), kẻ tấn công có thể dò ra **danh sách email đã đăng ký** bằng cách thử hàng loạt địa chỉ và quan sát response khác nhau — gọi là "user enumeration". Với `resend-verification` (khác với `register`, xem quyết định #10), ta chọn **luôn trả cùng 1 response** bất kể nhánh xử lý bên trong khác nhau thế nào.

Mở `src/auth/services/auth.service.ts` và thêm method mới:

```ts
// src/auth/services/auth.service.ts (thêm vào class AuthService đã có)
import { ResendVerificationDto } from '../dto/resend-verification.dto';

// ... trong class AuthService

private static readonly GENERIC_RESEND_MESSAGE =
  'If the email exists and is not yet verified, a new verification email has been sent.';

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
      `Failed to resend verification email to ${user.email}`,
      err as Error,
    );
    // Không throw lại — vẫn trả message chung chung như case thành công,
    // user có thể tự thử resend lại lần nữa.
  }

  return { message: AuthService.GENERIC_RESEND_MESSAGE };
}
```

⚠️ Method này dùng `this.tokenService.createEmailVerificationToken()` (đã viết đầy đủ ở 01-setup.md, phần TokenService đầy đủ) — khác với `AuthService.register()` (02-register.md, Bước 5) phải tự viết `createVerificationTokenInTx` vì cần chung transaction. Ở đây không cần transaction (chỉ 1 write), nên gọi thẳng qua `TokenService` bình thường.

Tự kiểm tra: gọi với email tồn tại & chưa verify phải trả `GENERIC_RESEND_MESSAGE`, tạo token mới, gọi `sendVerificationEmail`. Gọi với email đã verified, hoặc email không tồn tại luôn — cả 2 case này đều phải trả **cùng** `GENERIC_RESEND_MESSAGE`, không tạo token, không gọi mail. Điểm quan trọng nhất: 3 case trên phải trả về response **giống hệt nhau về status code + message** — đừng chỉ đọc bằng mắt, viết test so sánh trực tiếp mới chắc chắn.

---

## Bước 3 — Mở endpoint HTTP

Bước cuối, expose route `POST /auth/resend-verification`:

```ts
// src/auth/auth.controller.ts (thêm import + route vào class AuthController đã có)
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { MessageResponseDto } from './dto/message-response.dto'; // đã tạo ở 03-verify-email.md, Bước 2

// ... trong class AuthController

@Post('resend-verification')
@HttpCode(HttpStatus.OK)
async resendVerification(
  @Body() dto: ResendVerificationDto,
): Promise<MessageResponseDto> {
  return this.authService.resendVerification(dto);
}
```

Gọi thử toàn bộ flow (Bước 1 → 3) qua Postman/curl: response luôn cùng 1 dạng message/status bất kể email tồn tại hay không; email tồn tại & chưa verify thì token mới được tạo và email được gửi (xem log console); email đã verified thì không tạo token mới nhưng response vẫn y hệt case hợp lệ. Khi viết test chính thức ở [13-testing.md](./13-testing.md), nhớ cover đủ 3 nhánh: email tồn tại & chưa verify, email đã verified, và email không tồn tại — case cuối đặc biệt quan trọng vì response phải không phân biệt được với case hợp lệ.

---

➡️ Tiếp theo: [05-login.md](./05-login.md)
