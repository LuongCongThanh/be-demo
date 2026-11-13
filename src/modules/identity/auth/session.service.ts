import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccountType } from '#src/generated/prisma/enums.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { LoginDto } from '#src/modules/identity/auth/dto/login.dto.js';
import { PasswordService } from '#src/modules/identity/auth/password.service.js';
import { TokenService } from '#src/modules/identity/auth/token.service.js';

export interface LoginResult {
  accessToken: string;
  rawRefreshToken: string;
  user: { id: string; email: string; fullName: string; role: AccountType; emailVerified: boolean };
}

export interface RefreshTokenResult {
  accessToken: string;
  newRawRefreshToken: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
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
    // Lỗi chung, giống sai mật khẩu: không lộ việc tài khoản (vd. Staff đã
    // nghỉ việc) tồn tại nhưng bị vô hiệu hoá.
    if (user.status === 'DISABLED') {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email is not verified');
    }

    const accessToken = this.signAccessToken(user);
    const rawRefreshToken = await this.tokenService.createRefreshToken(user.id);

    return {
      accessToken,
      rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
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
      include: { user: true },
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

    // Disable đã thu hồi refresh token trong cùng transaction; check này là
    // lưới an toàn nếu có token nào lọt (vd. tạo đồng thời với lúc disable).
    if (record.user.status === 'DISABLED') {
      throw new UnauthorizedException('Invalid refresh token');
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
    const accessToken = this.signAccessToken(record.user);

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

  /**
   * Sinh JWT access token — dùng chung cho login() và refreshToken().
   *
   * Payload chỉ chứa thông tin nhận diện + phân quyền (sub, email, role,
   * sessionVersion) — KHÔNG nhét passwordHash/refresh token/dữ liệu cá nhân
   * (JWT payload không được mã hoá, ai cũng đọc được nếu có token).
   */
  private signAccessToken(user: { id: string; email: string; role: AccountType; sessionVersion: number }): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion,
    });
  }
}
