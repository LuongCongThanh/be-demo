# 10 — Forgot Password (`POST /auth/forgot-password`)

> ⬅️ Trước khi làm file này: xong [09-logout.md](./09-logout.md) (guards, login, refresh, logout đã chạy được).
> 📚 Tham chiếu chung (Decisions, Security Rules, Response DTO...): [00-overview.md](./00-overview.md).

**Goal:** Cho phép user yêu cầu reset password mà không lộ thông tin email có tồn tại hay không (quyết định #10).

**Files:** `src/auth/dto/forgot-password.dto.ts`, `src/auth/services/auth.service.ts`, `src/auth/auth.controller.ts`

**CLI:**

```powershell
New-Item src/auth/dto/forgot-password.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/forgot-password.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

> 📘 **Khái niệm — vì sao response phải "chung chung" (không tiết lộ email có tồn tại hay không)?**
> Nếu `forgot-password` trả lỗi khác nhau tuỳ email có tồn tại hay không (vd "email không tồn tại" vs "đã gửi link reset"), kẻ tấn công có thể dò ra **danh sách email đã đăng ký** bằng cách thử hàng loạt — gọi là **email/user enumeration**. Đây là thông tin nhạy cảm vì email trùng với tài khoản ngân hàng/mạng xã hội khác, phục vụ tấn công phishing có chủ đích. Vì vậy `forgot-password` (và `resend-verification`, xem [04-resend-verification.md](./04-resend-verification.md)) luôn trả **đúng 1 dạng response** dù email có tồn tại hay không — khác với `register`, nơi 409 rõ ràng lại chấp nhận được vì UX cần biết "email đã dùng, đăng nhập thay vì đăng ký" (quyết định #10).

1. `ForgotPasswordDto`:

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

2. `AuthService.forgotPassword()` — thêm vào `src/auth/services/auth.service.ts` (dùng chung `TokenService`, `MailService` đã có từ [01-setup.md](./01-setup.md), [02-register.md](./02-register.md)):

   ```ts
   // src/auth/services/auth.service.ts (thêm method)
   async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
     const GENERIC_MESSAGE = {
       message: 'Nếu email tồn tại, một link reset password đã được gửi.',
     };

     const user = await this.prisma.user.findUnique({
       where: { email: dto.email },
     });

     // Không tồn tại → vẫn trả message giống hệt case hợp lệ, KHÔNG throw 404.
     if (!user) {
       return GENERIC_MESSAGE;
     }

     // TokenService tự xoá password reset token cũ chưa dùng trước khi tạo mới
     // (quyết định #8) — xem 01-setup.md STEP 7.
     const rawToken = await this.tokenService.createPasswordResetToken(user.id);

     // Gửi email SAU khi token đã được ghi DB xong (không có transaction ở đây
     // vì chỉ có 1 write DB — nguyên tắc "transaction không bọc external call"
     // vẫn áp dụng: try/catch riêng, không để lỗi mail làm hỏng response).
     try {
       await this.mailService.sendPasswordResetEmail(user.email, rawToken);
     } catch (err) {
       this.logger.error(
         `Gửi reset-password email thất bại cho ${user.email}`,
         err as Error,
       );
       // Không throw lại — vẫn trả message chung chung như case thành công,
       // để không lộ sự khác biệt qua timing/response giữa "gửi được" và
       // "gửi lỗi". User có thể gọi lại forgot-password nếu không nhận được mail.
     }

     return GENERIC_MESSAGE;
   }
   ```

3. Controller — response qua `MessageResponseDto` dùng chung (đã tạo ở [03-verify-email.md § STEP 8.2](./03-verify-email.md)):

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

**Acceptance Criteria:**

- [ ] Response luôn cùng 1 dạng (status + message) bất kể email tồn tại hay không.
- [ ] Email tồn tại → token mới được tạo trong `password_reset_tokens`, email được gửi (kiểm tra qua log `MailService` ở môi trường dev).
- [ ] Email không tồn tại → không tạo token nào, nhưng response giống hệt case tồn tại.
- [ ] Gửi mail lỗi (throw) → vẫn trả message thành công, lỗi được log lại.

**Tests:**

- forgot-password với email tồn tại → tạo token + gửi mail.
- forgot-password với email không tồn tại → response giống hệt case tồn tại (so sánh cả status code lẫn body).
- forgot-password gọi 2 lần liên tiếp cho cùng email → chỉ còn 1 password reset token hợp lệ trong DB (token cũ bị xoá).

---

➡️ Tiếp theo: [11-reset-password.md](./11-reset-password.md)
