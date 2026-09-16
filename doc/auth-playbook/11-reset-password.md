# 11: Reset Password (`POST /auth/reset-password`)

> Trước khi làm file này: xong [10-forgot-password.md](./10-forgot-password.md). Tham chiếu chung (Decisions, Security Rules, Response DTO...): [00-overview.md](./00-overview.md).

Endpoint cuối cùng của flow quên mật khẩu: đặt lại password bằng token nhận từ email, đồng thời thu hồi toàn bộ session cũ. Chia thành 3 bước.

> 📘 **Khái niệm: vì sao đổi password PHẢI revoke toàn bộ refresh token cũ?**
> Nếu ai đó lấy được password cũ (hoặc chính user nghi ngờ tài khoản bị lộ) và tự đặt lại password mới, mọi thiết bị/trình duyệt đang đăng nhập bằng refresh token cũ phải bị đăng xuất. Nếu không, kẻ đã chiếm được session trước đó (vd đánh cắp refresh token) vẫn tiếp tục dùng được dù password đã đổi. Đây là lý do reset-password luôn đi kèm "revoke toàn bộ refresh token của user" (giống hệt tinh thần "logout-all", xem [09-logout.md](./09-logout.md)): reset-password là dấu hiệu bảo mật quan trọng hơn logout thông thường.
>
> 📘 **Khái niệm: vì sao không đủ nếu chỉ check `resetToken.usedAt` rồi mới update — phải "claim" token bằng conditional update?** Giống hệt lý do ở `03-verify-email.md`: bước `findUnique` (đọc) và bước update `usedAt` (ghi) là 2 thao tác tách rời, không atomic. Nếu 2 request cùng gửi đúng 1 token hợp lệ gần như đồng thời, cả 2 đều có thể đọc được `usedAt: null` **trước khi** request nào commit xong — cả 2 cùng vượt qua check, cùng đổi password (ai commit sau "thắng" một cách ngẫu nhiên), vi phạm bất biến "token dùng 1 lần". Cách khắc phục: "giành" (claim) token bằng 1 câu update có điều kiện `usedAt: null` ngay trong `WHERE`, để DB đảm bảo chỉ 1 request thắng; request thua coi như gặp token đã dùng.

---

## Bước 1: Mô tả dữ liệu client gửi lên (ResetPasswordDto)

Client cần gửi 3 thứ: token nhận từ email, password mới, và confirmPassword để so khớp. Bước này dùng lại `IsStrongPassword()` đã viết ở [01-setup.md](./01-setup.md), phần password policy, cộng thêm 1 custom validator để so khớp `confirmPassword`.

> 📘 **Khái niệm: custom validator so khớp 2 field.** `class-validator` validate từng field độc lập theo mặc định. Để so sánh 2 field với nhau (password vs confirmPassword) cần 1 custom decorator (`@Validate(SomeConstraint)`) đọc được toàn bộ object đang validate qua `ValidationArguments.object`, thay vì chỉ đọc giá trị của riêng field đó.

Tạo file `src/auth/dto/reset-password.dto.ts`:

```powershell
New-Item src/auth/dto/reset-password.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/reset-password.dto.ts   # Bash (Git Bash/WSL)
```

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
    return 'confirmPassword must match password';
  }
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Raw token received via email' })
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

---

## Bước 2: Viết AuthService.resetPassword()

Đây là phần lõi: hash token nhận được để tra DB, kiểm tra còn hợp lệ không, rồi trong 1 transaction đổi password mới, đánh dấu token đã dùng, và revoke toàn bộ refresh token cũ:

```ts
// src/auth/services/auth.service.ts (thêm method)
import { BadRequestException } from '@nestjs/common';

async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
  // 1. Hash raw token nhận từ client để so khớp với DB — không bao giờ query
  //    DB bằng raw token (DB chỉ lưu tokenHash, xem 01-setup.md, phần TokenService).
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
    throw new BadRequestException('Invalid or expired token');
  }

  const newPasswordHash = await this.passwordService.hash(dto.password);

  // 2. "Claim" token bằng conditional update (usedAt: null trong WHERE) để
  //    đóng race window giữa findUnique() ở trên và update này — xem khái
  //    niệm ở trên. Chỉ khi claim thắng mới update password mới + revoke
  //    TOÀN BỘ refresh token của user (không chỉ 1 cái).
  const wonRace = await this.prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) {
      return false;
    }

    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: newPasswordHash },
    });
    await tx.refreshToken.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return true;
  });

  if (!wonRace) {
    throw new BadRequestException('Invalid or expired token');
  }

  return { message: 'Password has been reset. Please log in again.' };
}
```

Dùng dạng callback `this.prisma.$transaction(async (tx) => {...})` thay vì dạng mảng `$transaction([...])`, giống lý do đã giải thích ở [02-register.md](./02-register.md)/[03-verify-email.md](./03-verify-email.md): bước thứ 2 (update password + revoke refresh token) _phụ thuộc kết quả_ của bước claim (`claimed.count`), nên không thể dùng dạng mảng (mảng chạy tất cả các Promise vô điều kiện, không có chỗ để rẽ nhánh dựa trên kết quả bước trước).

---

## Bước 3: Mở endpoint HTTP

Nối route vào `AuthController`, response qua `MessageResponseDto` dùng chung (đã tạo ở [03-verify-email.md](./03-verify-email.md)):

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

Tự kiểm tra toàn bộ flow: reset thành công thì password mới phải login được, password cũ thì không login được nữa; tất cả refresh token cũ của user phải bị revoke (verify bằng cách gọi `/auth/refresh` với refresh token cũ, xem [06-refresh-token.md](./06-refresh-token.md): phải nhận `401`); token không tồn tại/hết hạn/đã dùng phải trả `400`; password mới không đủ policy hoặc không khớp `confirmPassword` cũng phải trả `400`. Khi viết test chính thức ở [13-testing.md](./13-testing.md), nhớ thêm case gọi lại lần 2 với cùng 1 token đã dùng ở lần trước: phải bị từ chối, không phải hành vi idempotent; và case 2 request reset-password gần như đồng thời cùng 1 token hợp lệ (`Promise.all(...)`): đúng 1 request phải thành công, request còn lại phải nhận `400` (không có trường hợp cả 2 cùng đổi được password).

---

➡️ Tiếp theo: [12-rate-limiting.md](./12-rate-limiting.md)
