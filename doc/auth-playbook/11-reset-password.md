# 11 — Reset Password (`POST /auth/reset-password`)

> ⬅️ Trước khi làm file này: xong [10-forgot-password.md](./10-forgot-password.md).
> 📚 Tham chiếu chung (Decisions, Security Rules, Response DTO...): [00-overview.md](./00-overview.md).

**Goal:** Đặt lại password bằng token nhận từ email, thu hồi toàn bộ session cũ.

**Files:** `src/auth/dto/reset-password.dto.ts`, `src/auth/services/auth.service.ts`, `src/auth/auth.controller.ts`

**CLI:**

```powershell
New-Item src/auth/dto/reset-password.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/reset-password.dto.ts   # Bash (Git Bash/WSL)
```

**Implementation:**

> 📘 **Khái niệm — vì sao đổi password PHẢI revoke toàn bộ refresh token cũ?**
> Nếu ai đó lấy được password cũ (hoặc chính user nghi ngờ tài khoản bị lộ) và tự đặt lại password mới, mọi thiết bị/trình duyệt đang đăng nhập bằng refresh token cũ **phải bị đăng xuất** — nếu không, kẻ đã chiếm được session trước đó (vd đánh cắp refresh token) vẫn tiếp tục dùng được dù password đã đổi. Đây là lý do reset-password luôn đi kèm "revoke toàn bộ refresh token của user" (giống hệt tinh thần "logout-all", xem [09-logout.md](./09-logout.md)) — reset-password là dấu hiệu bảo mật quan trọng hơn logout thông thường.

1. `ResetPasswordDto` — dùng lại `IsStrongPassword()` đã viết ở [01-setup.md § STEP 6](./01-setup.md), thêm custom validator so khớp `confirmPassword`:

   > 📘 **Khái niệm — `@ValidateIf` / custom validator so khớp 2 field:** `class-validator` validate từng field độc lập theo mặc định — để so sánh 2 field với nhau (password vs confirmPassword) cần 1 custom decorator đọc được toàn bộ object đang validate qua `ValidationArguments.object`.

   ```ts
   // src/auth/dto/reset-password.dto.ts
   import { ApiProperty } from '@nestjs/swagger';
   import {
     IsString,
     Validate,
     ValidationArguments,
     ValidatorConstraint,
     ValidatorConstraintInterface,
   } from 'class-validator';
   import { IsStrongPassword } from '../decorators/is-strong-password.decorator';

   @ValidatorConstraint({ name: 'MatchesPassword', async: false })
   class MatchesPasswordConstraint implements ValidatorConstraintInterface {
     validate(confirmPassword: string, args: ValidationArguments) {
       const dto = args.object as ResetPasswordDto;
       return confirmPassword === dto.password;
     }
     defaultMessage() {
       return 'confirmPassword phải khớp với password';
     }
   }

   export class ResetPasswordDto {
     @ApiProperty({ description: 'Raw token nhận được qua email' })
     @IsString()
     token: string;

     @ApiProperty({ example: 'NewAbc@1234' })
     @IsString()
     @IsStrongPassword()
     password: string;

     @ApiProperty({ example: 'NewAbc@1234' })
     @IsString()
     @Validate(MatchesPasswordConstraint)
     confirmPassword: string;
   }
   ```

2. `AuthService.resetPassword()`:

   ```ts
   // src/auth/services/auth.service.ts (thêm method)
   import { BadRequestException } from '@nestjs/common';

   async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
     // 1. Hash raw token nhận từ client để so khớp với DB — không bao giờ query
     //    DB bằng raw token (DB chỉ lưu tokenHash, xem 01-setup.md STEP 7).
     const tokenHash = this.tokenService.hashRawToken(dto.token);

     const resetToken = await this.prisma.passwordResetToken.findUnique({
       where: { tokenHash },
     });

     if (
       !resetToken ||
       resetToken.usedAt !== null ||
       resetToken.expiresAt < new Date()
     ) {
       // Không phân biệt "không tồn tại" / "đã dùng" / "hết hạn" trong message
       // trả về client — tránh lộ thông tin thừa, nhưng KHÔNG cần giấu như
       // forgot-password (đây là bước sau khi đã có token, không phải dò email).
       throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
     }

     const newPasswordHash = await this.passwordService.hash(dto.password);

     // 2. Transaction: update password mới + đánh dấu token đã dùng + revoke
     //    TOÀN BỘ refresh token của user (không chỉ 1 cái) — xem khái niệm ở trên.
     await this.prisma.$transaction([
       this.prisma.user.update({
         where: { id: resetToken.userId },
         data: { passwordHash: newPasswordHash },
       }),
       this.prisma.passwordResetToken.update({
         where: { id: resetToken.id },
         data: { usedAt: new Date() },
       }),
       this.prisma.refreshToken.updateMany({
         where: { userId: resetToken.userId, revokedAt: null },
         data: { revokedAt: new Date() },
       }),
     ]);

     return { message: 'Password đã được đặt lại. Vui lòng đăng nhập lại.' };
   }
   ```

   > `prisma.$transaction([...])` (dạng mảng, khác với dạng `$transaction(async (tx) => {...})` đã dùng ở [02-register.md](./02-register.md)) chạy nhiều query độc lập trong 1 transaction khi chúng **không phụ thuộc kết quả của nhau** — ở đây cả 3 query đều đã biết sẵn `resetToken.userId`/`resetToken.id` từ bước 1, không cần đọc lại giá trị vừa ghi, nên dùng dạng mảng cho gọn.

3. Controller — response qua `MessageResponseDto` dùng chung (đã tạo ở [03-verify-email.md § STEP 8.2](./03-verify-email.md)):

   ```ts
   // src/auth/auth.controller.ts (thêm import + route vào class đã có)
   import { ResetPasswordDto } from './dto/reset-password.dto';
   import { MessageResponseDto } from './dto/message-response.dto';

   // ... trong class AuthController

   @Post('reset-password')
   @HttpCode(HttpStatus.OK)
   async resetPassword(
     @Body() dto: ResetPasswordDto,
   ): Promise<MessageResponseDto> {
     return this.authService.resetPassword(dto);
   }
   ```

**Acceptance Criteria:**

- [ ] Reset thành công → password mới hoạt động (login được), password cũ không login được nữa.
- [ ] Tất cả refresh token cũ của user bị revoke (verify qua [06-refresh-token.md](./06-refresh-token.md): gọi `/auth/refresh` với refresh token cũ → 401).
- [ ] Token không tồn tại / hết hạn / đã dùng → 400.
- [ ] Password mới không đủ policy hoặc không khớp `confirmPassword` → 400.

**Tests:**

- reset-password success + verify tất cả session cũ bị logout (refresh token cũ không dùng được).
- reset-password với token hết hạn.
- reset-password với token đã dùng (gọi lại lần 2 với cùng token đã dùng ở test trước → 400).
- reset-password với `confirmPassword` không khớp `password` → 400.

---

➡️ Tiếp theo: [12-rate-limiting.md](./12-rate-limiting.md)
