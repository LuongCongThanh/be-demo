# 10 — Forgot Password (`POST /auth/forgot-password`)

> Trước khi làm file này: xong [09-logout.md](./09-logout.md). Guards, login, refresh, logout phải chạy được trước. Tham chiếu chung (Decisions, Security Rules, Response DTO...): [00-overview.md](./00-overview.md).

Endpoint này cho phép user yêu cầu reset password, mà không lộ thông tin email có tồn tại trong hệ thống hay không (quyết định #10). Chia thành 3 bước: DTO, logic service, rồi controller.

> 📘 **Khái niệm: vì sao response phải "chung chung" (không tiết lộ email có tồn tại hay không)?**
> Nếu `forgot-password` trả lỗi khác nhau tuỳ email có tồn tại hay không (vd "email không tồn tại" vs "đã gửi link reset"), kẻ tấn công có thể dò ra danh sách email đã đăng ký bằng cách thử hàng loạt. Hành vi này gọi là **email/user enumeration**. Đây là thông tin nhạy cảm vì email trùng với tài khoản ngân hàng/mạng xã hội khác, phục vụ tấn công phishing có chủ đích. Vì vậy `forgot-password` (và `resend-verification`, xem [04-resend-verification.md](./04-resend-verification.md)) luôn trả đúng 1 dạng response dù email có tồn tại hay không, khác với `register`, nơi 409 rõ ràng lại chấp nhận được vì UX cần biết "email đã dùng, đăng nhập thay vì đăng ký" (quyết định #10).

---

## Bước 1 — Mô tả dữ liệu client gửi lên (ForgotPasswordDto)

Client chỉ cần gửi 1 field duy nhất: email. Tạo file `src/auth/dto/forgot-password.dto.ts`:

```powershell
New-Item src/auth/dto/forgot-password.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/forgot-password.dto.ts   # Bash (Git Bash/WSL)
```

```ts
// src/auth/dto/forgot-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}
```

---

## Bước 2 — Viết logic không lộ enumeration trong AuthService

Thêm method mới vào `src/auth/services/auth.service.ts`, dùng chung `TokenService`, `MailService` đã có sẵn từ [01-setup.md](./01-setup.md) và [02-register.md](./02-register.md):

```ts
// src/auth/services/auth.service.ts (thêm method)
async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
  const GENERIC_MESSAGE = {
    message: 'If the email exists, a password reset link has been sent.',
  };

  const user = await this.prisma.user.findUnique({
    where: { email: dto.email },
  });

  // Không tồn tại → vẫn trả message giống hệt case hợp lệ, KHÔNG throw 404.
  if (!user) {
    return GENERIC_MESSAGE;
  }

  // TokenService tự xoá password reset token cũ chưa dùng trước khi tạo mới
  // (quyết định #8) — xem 01-setup.md, phần TokenService đầy đủ.
  const rawToken = await this.tokenService.createPasswordResetToken(user.id);

  // Gửi email SAU khi token đã được ghi DB xong (không có transaction ở đây
  // vì chỉ có 1 write DB — nguyên tắc "transaction không bọc external call"
  // vẫn áp dụng: try/catch riêng, không để lỗi mail làm hỏng response).
  try {
    await this.mailService.sendPasswordResetEmail(user.email, rawToken);
  } catch (err) {
    this.logger.error(
      `Failed to send password reset email to ${user.email}`,
      err as Error,
    );
    // Không throw lại — vẫn trả message chung chung như case thành công,
    // để không lộ sự khác biệt qua timing/response giữa "gửi được" và
    // "gửi lỗi". User có thể gọi lại forgot-password nếu không nhận được mail.
  }

  return GENERIC_MESSAGE;
}
```

Tự kiểm tra: gọi với email tồn tại phải thấy token mới xuất hiện trong `password_reset_tokens` và mail được gửi (xem log `MailService` ở môi trường dev). Gọi với email không tồn tại thì không được tạo token nào, nhưng response phải giống hệt case tồn tại: so sánh cả status code lẫn body chứ không chỉ đọc bằng mắt. Gọi 2 lần liên tiếp cho cùng 1 email thì DB chỉ còn đúng 1 password reset token hợp lệ (token cũ bị xoá trước khi tạo mới). Thử luôn trường hợp gửi mail lỗi (tạm cho `sendPasswordResetEmail` throw). Response vẫn phải trả về message thành công như bình thường, chỉ có dòng log lỗi xuất hiện.

---

## Bước 3 — Mở endpoint HTTP

Nối route vào `AuthController`, response qua `MessageResponseDto` dùng chung (đã tạo ở [03-verify-email.md](./03-verify-email.md)):

```ts
// src/auth/auth.controller.ts (thêm import + route vào class đã có)
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { MessageResponseDto } from './dto/message-response.dto';

// ... trong class AuthController

@Post('forgot-password')
@HttpCode(HttpStatus.OK)
async forgotPassword(
  @Body() dto: ForgotPasswordDto,
): Promise<MessageResponseDto> {
  return this.authService.forgotPassword(dto);
}
```

Khi viết test chính thức ở [13-testing.md](./13-testing.md), nhớ cover cả 3 nhánh: email tồn tại, email không tồn tại (response phải giống hệt case tồn tại), và trường hợp gọi lại nhiều lần liên tiếp cho cùng 1 email.

---

➡️ Tiếp theo: [11-reset-password.md](./11-reset-password.md)
