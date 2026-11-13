import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { ForgotPasswordDto } from '#src/modules/identity/dto/auth/forgot-password.dto.js';
import { ResetPasswordDto } from '#src/modules/identity/dto/auth/reset-password.dto.js';
import { MessageResponseDto } from '#src/modules/identity/dto/auth/message-response.dto.js';
import { PasswordService } from '#src/modules/identity/services/auth/password.service.js';
import { TokenService } from '#src/modules/identity/services/auth/token.service.js';
import { MailService } from '#src/infrastructure/mail/mail.service.js';
import { sendBestEffort } from '#src/modules/identity/services/auth/send-best-effort.js';

// Cùng tinh thần GENERIC_RESEND_MESSAGE ở trên — message chung cho
// forgotPassword() dù email tồn tại hay không, chống enumeration (quyết
// định #10).
export const GENERIC_FORGOT_PASSWORD_MESSAGE = 'If the email exists, a password reset link has been sent.';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Không tồn tại → vẫn trả message giống hệt case hợp lệ, KHÔNG throw 404
    // (chống enumeration, quyết định #10).
    if (!user) {
      return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
    }

    const rawToken = await this.tokenService.createPasswordResetToken(user.id);
    await sendBestEffort(
      this.logger,
      () => this.mailService.sendPasswordResetEmail(user.email, rawToken),
      `Failed to send password reset email to ${user.email}`,
    );

    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    // Hash raw token nhận từ client để so khớp với DB — không bao giờ query
    // DB bằng raw token (DB chỉ lưu tokenHash).
    const tokenHash = this.tokenService.hashRawToken(dto.token);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt < new Date()) {
      // Không phân biệt "không tồn tại" / "đã dùng" / "hết hạn" trong message
      // trả về client — tránh lộ thông tin thừa.
      throw new BadRequestException('Invalid or expired token');
    }

    // Claim token TRƯỚC khi hash password mới: hash (argon2) tốn CPU, nếu
    // hash trước rồi mới claim thì request thua race phí công hash một mật
    // khẩu sẽ bị vứt bỏ. Claim trước cũng tránh giữ transaction DB mở trong
    // lúc argon2 chạy (như lý do register() hash password ngoài transaction).
    const wonRace = await this.claimPasswordResetToken(resetToken.id);
    if (!wonRace) {
      throw new BadRequestException('Invalid or expired token');
    }

    const newPasswordHash = await this.passwordService.hash(dto.password);
    await this.applyPasswordReset(resetToken.userId, newPasswordHash);

    return { message: 'Password has been reset. Please log in again.' };
  }

  // "Claim" token bằng conditional update (usedAt: null trong WHERE) để đóng
  // race window giữa findUnique() ở caller và update này — cùng lý do như
  // claimEmailVerification() ở trên.
  private async claimPasswordResetToken(tokenId: string): Promise<boolean> {
    const claimed = await this.prisma.passwordResetToken.updateMany({
      where: { id: tokenId, usedAt: null },
      data: { usedAt: new Date() },
    });
    return claimed.count > 0;
  }

  // Chỉ gọi sau khi đã thắng race claim token ở trên: update password mới +
  // revoke TOÀN BỘ refresh token của user (không chỉ 1 cái, giống logout-all
  // — xem 11-reset-password.md).
  private async applyPasswordReset(userId: string, newPasswordHash: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}
