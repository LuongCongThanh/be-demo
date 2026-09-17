import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../generated/prisma/client.js';
import { getUniqueConstraintTarget } from '../../common/prisma-error.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ResendVerificationDto } from '../dto/resend-verification.dto.js';
import { ForgotPasswordDto } from '../dto/forgot-password.dto.js';
import { ResetPasswordDto } from '../dto/reset-password.dto.js';
import { VerifyEmailDto } from '../dto/verify-email.dto.js';
import { LoginDto } from '../dto/login.dto.js';
import { AuthUserResponseDto } from '../dto/auth-user-response.dto.js';
import { MessageResponseDto } from '../dto/message-response.dto.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { MailService } from '../../mail/mail.service.js';
import { RegisterDto } from '../dto/register.dto.js';
import { RegisterResponseDto } from '../dto/register-response.dto.js';

// Code 6 chữ số chỉ có 1.000.000 khả năng, khác với raw token 32-byte cũ,
// nên có thể bị brute-force trong thời gian hết hạn nếu không giới hạn số
// lần đoán sai.
export const MAX_VERIFY_ATTEMPTS = 5;

// Message chung cho resendVerification() dù email không tồn tại, đã verify
// rồi, hay vừa được cấp code mới — export để test tham chiếu trực tiếp thay
// vì hard-code lại chuỗi, tránh lệch nhau khi message đổi.
export const GENERIC_RESEND_MESSAGE =
  'If the email exists and is not yet verified, a new verification email has been sent.';

// Cùng tinh thần GENERIC_RESEND_MESSAGE ở trên — message chung cho
// forgotPassword() dù email tồn tại hay không, chống enumeration (quyết
// định #10).
export const GENERIC_FORGOT_PASSWORD_MESSAGE = 'If the email exists, a password reset link has been sent.';

export interface LoginResult {
  accessToken: string;
  rawRefreshToken: string;
  user: { id: string; email: string; fullName: string; roles: string[]; emailVerified: boolean };
}

export interface RefreshTokenResult {
  accessToken: string;
  newRawRefreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    // Kiểm tra email trùng tường minh (thay vì dựa vào DB unique constraint
    // throw lỗi) để trả 409 rõ ràng trước khi tốn công hash/ghi DB, và đúng
    // theo decision #10: register cần lỗi "email đã tồn tại" rõ ràng, khác
    // với forgot-password hay resend-verification (cố tình giấu việc email
    // có tồn tại hay không).
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    // Hash password tốn CPU và không đụng tới DB, nên làm trước (và ngoài)
    // transaction, tránh giữ transaction DB mở trong lúc argon2 chạy.
    const passwordHash = await this.passwordService.hash(dto.password);

    let user: { id: string; email: string };
    let rawCode: string;
    try {
      ({ user, rawCode } = await this.prisma.$transaction(async (tx) => {
        const customerRole = await tx.role.findUniqueOrThrow({
          where: { name: 'CUSTOMER' },
        });

        const createdUser = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            fullName: dto.fullName,
            phone: dto.phone,
            status: 'ACTIVE',
            userRoles: { create: [{ roleId: customerRole.id }] },
          },
        });

        const code = await this.tokenService.createEmailVerificationToken(createdUser.id, tx);

        return { user: createdUser, rawCode: code };
      }));
    } catch (err) {
      // Check findUnique ở trên chỉ chặn được phần lớn trường hợp trùng
      // email; 2 request đồng thời cùng email đều có thể pass check đó, nên
      // unique constraint của DB mới là chốt chặn thật sự. Chuyển race đó
      // thành cùng lỗi 409 như pre-check — nhưng chỉ khi constraint bị vi
      // phạm đúng là `email`. Transaction này cũng tạo EmailVerificationToken
      // với `tokenHash` unique riêng, nên chỉ check `code === 'P2002'` sẽ
      // báo nhầm một collision tokenHash (cực hiếm) thành "email đã tồn tại".
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        getUniqueConstraintTarget(err)?.includes('email')
      ) {
        throw new ConflictException('Email is already in use');
      }
      throw err;
    }

    // Gửi email là external call, phải chạy SAU khi transaction đã commit —
    // không bao giờ đặt trong transaction (SMTP chậm/treo sẽ giữ lock DB).
    // Lỗi ở đây chỉ log lại, không rollback hay fail request: user đã tạo
    // thành công và có thể dùng "resend verification" để nhận code mới.
    await this.sendBestEffort(
      () => this.mailService.sendVerificationEmail(user.email, rawCode),
      `Failed to send verification email to ${user.email}`,
    );

    return { id: user.id, email: user.email };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<MessageResponseDto> {
    // Code 6 chữ số (chỉ 1.000.000 khả năng) không đủ unique để tự nó định
    // danh 1 record an toàn — khác với raw token 32-byte cũ — nên tìm code
    // đang chờ của user theo userId trước (chỉ có tối đa 1, vì
    // createEmailVerificationToken() đã xóa mọi token chưa verify trước đó),
    // rồi so hash tại đây. Cách này cũng cho phép đếm cả lượt đoán sai vào
    // `attempts`, điều mà lookup theo tokenHash không làm được (code sai thì
    // đơn giản là không match row nào).
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const record = user
      ? await this.prisma.emailVerificationToken.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    if (!record) {
      // Cùng 1 lỗi cho cả 2 trường hợp email không tồn tại hoặc không có
      // code đang chờ — không lộ ra là trường hợp nào.
      throw new NotFoundException('Invalid email or code');
    }
    if (record.verifiedAt) {
      // Chống replay: code đã dùng rồi, gọi lại lần 2 phải bị reject
      // (không phải hành vi idempotent).
      throw new BadRequestException('Code already used');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Code has expired');
    }
    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException('Too many attempts. Request a new code.');
    }

    if (this.tokenService.hashRawToken(dto.code) !== record.tokenHash) {
      // Vẫn tính lượt đoán sai này dù code không hợp lệ — đây chính là cách
      // giới hạn brute-force code 6 chữ số trong thời gian hết hạn. Dùng
      // updateMany với điều kiện `attempts: { lt: MAX_VERIFY_ATTEMPTS }`
      // thay vì update thường, để tránh race: nhiều request đoán sai đến
      // cùng lúc khi attempts đang ở ngưỡng gần giới hạn có thể đều đọc thấy
      // "chưa vượt giới hạn" và đều tăng, khiến attempts vượt quá
      // MAX_VERIFY_ATTEMPTS. Điều kiện trong WHERE để DB tự xử lý atomic.
      await this.prisma.emailVerificationToken.updateMany({
        where: { id: record.id, attempts: { lt: MAX_VERIFY_ATTEMPTS } },
        data: { attempts: { increment: 1 } },
      });
      throw new NotFoundException('Invalid email or code');
    }

    const wonRace = await this.claimEmailVerification(record.id, record.userId);
    if (!wonRace) {
      throw new BadRequestException('Code already used');
    }

    return { message: 'Email verified successfully' };
  }

  // Read findFirst() ở caller không atomic với update ở đây, nên 2 request
  // đồng thời cho cùng 1 token đều có thể pass check record.verifiedAt trước
  // khi cái nào commit. Chống race này bằng cách "claim" token qua conditional
  // update (`verifiedAt: null` trong WHERE) trong transaction: DB tự đảm bảo
  // chỉ 1 caller thắng. Nếu thua race, không cần undo gì thêm, reject giống
  // như token đã dùng rồi.
  private async claimEmailVerification(tokenId: string, userId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationToken.updateMany({
        where: { id: tokenId, verifiedAt: null },
        data: { verifiedAt: new Date() },
      });
      if (claimed.count === 0) {
        return false;
      }

      await tx.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
      return true;
    });
  }

  async resendVerification(dto: ResendVerificationDto): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.emailVerifiedAt) {
      return { message: GENERIC_RESEND_MESSAGE };
    }

    const rawCode = await this.tokenService.createEmailVerificationToken(user.id);
    await this.sendBestEffort(
      () => this.mailService.sendVerificationEmail(user.email, rawCode),
      `Failed to send verification email to ${user.email}`,
    );

    return { message: GENERIC_RESEND_MESSAGE };
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { userRoles: { include: { role: true } } },
    });

    // Không tồn tại → lỗi generic, KHÔNG phân biệt với sai password (chống
    // enumeration, xem 05-login.md).
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Kiểm tra CẢ HAI trục trạng thái (quyết định #15) — SAU khi đã xác nhận
    // password đúng, để không lộ thêm thông tin cho kẻ đoán sai password.
    if (user.status === 'BLOCKED') {
      throw new UnauthorizedException('Account is locked');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email is not verified');
    }

    const { accessToken, roles } = this.signAccessToken(user);
    const rawRefreshToken = await this.tokenService.createRefreshToken(user.id);

    return {
      accessToken,
      rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles,
        // Derive từ dữ liệu thật (không hardcode `true`): tại điểm này chắc
        // chắn email đã verify (đã check ở trên), nhưng derive vẫn an toàn
        // hơn nếu logic check phía trên đổi mà quên sửa dòng này.
        emailVerified: !!user.emailVerifiedAt,
      },
    };
  }

  async refreshToken(rawRefreshToken: string | undefined): Promise<RefreshTokenResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const tokenHash = this.tokenService.hashRawToken(rawRefreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { userRoles: { include: { role: true } } } } },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection (quyết định #3): revokedAt != null nghĩa là token này
    // đã bị rotation trước đó — ai đó đang dùng lại 1 bản sao cũ, dấu hiệu
    // rõ ràng token đã lộ. Revoke TOÀN BỘ session của user, không chỉ token
    // này, buộc login lại ở mọi thiết bị.
    if (record.revokedAt) {
      return this.revokeAllSessionsAsReuseDetected(record.userId);
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Rotation: "claim" quyền xoay vòng bằng conditional update, đóng race
    // window giữa findUnique() ở trên và update này. Chỉ request nào update
    // trúng đúng 1 dòng (revokedAt vẫn còn null tại thời điểm ghi) mới thắng
    // và được cấp token mới; request thua coi như gặp reuse.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (claimed.count === 0) {
      // Thua race: 1 request khác đã claim token này trước — từ góc nhìn
      // của request này, token đã bị "dùng" bởi ai đó khác, coi như reuse.
      return this.revokeAllSessionsAsReuseDetected(record.userId);
    }

    const newRawRefreshToken = await this.tokenService.createRefreshToken(record.userId);
    const { accessToken } = this.signAccessToken(record.user);

    return { accessToken, newRawRefreshToken };
  }

  // Revoke TOÀN BỘ session của user (không chỉ 1 token) rồi reject —
  // dùng chung cho cả 2 tình huống được coi là reuse: token có revokedAt
  // != null thật sự, và thua race khi claim quyền rotation (quyết định #3).
  private async revokeAllSessionsAsReuseDetected(userId: string): Promise<never> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedException(
      'Refresh token has been revoked — all login sessions have been logged out for security reasons',
    );
  }

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
    await this.sendBestEffort(
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

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashRawToken(rawRefreshToken);

    // Revoke đúng 1 refresh token (nếu tồn tại và chưa revoke) — không throw
    // lỗi nếu không tìm thấy, để tránh lộ thông tin token có hợp lệ hay không.
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string): Promise<AuthUserResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    // Map thủ công sang DTO allow-list — KHÔNG return thẳng `user` (có passwordHash).
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.userRoles.map((r) => r.role.name),
      emailVerified: user.emailVerifiedAt !== null,
    };
  }

  /**
   * Derive role names rồi sinh JWT access token trong 1 bước — dùng chung
   * cho login() và refreshToken() (cả 2 đều có sẵn `user` kèm `userRoles`
   * qua Prisma include), tránh lặp lại `.map()` + gọi sign() ở từng nơi.
   *
   * Payload JWT chỉ chứa thông tin cần để nhận diện user (sub = userId,
   * email, roles) — KHÔNG nhét passwordHash/refresh token/dữ liệu cá nhân
   * không cần thiết (JWT payload không được mã hoá, ai cũng đọc được nếu có
   * token).
   */
  private signAccessToken(user: { id: string; email: string; userRoles: { role: { name: string } }[] }): {
    accessToken: string;
    roles: string[];
  } {
    const roles = user.userRoles.map((ur) => ur.role.name);
    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email, roles });
    return { accessToken, roles };
  }

  // Dùng chung cho mọi lần gửi mail "best effort": lỗi chỉ log lại, không
  // throw — caller (register/resendVerification/forgotPassword) đã hoàn tất
  // phần việc chính của mình (tạo user / tạo token mới), gửi mail thất bại
  // không nên làm fail cả request đó.
  private async sendBestEffort(send: () => Promise<void>, errorMessage: string): Promise<void> {
    try {
      await send();
    } catch (err) {
      this.logger.error(errorMessage, err as Error);
    }
  }
}
