import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Role } from '#src/generated/prisma/enums.js';
import { PrismaService } from '#src/prisma/prisma.service.js';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: Role; // đúng 1 vai trò mỗi Tài khoản (ADR 0005)
  sessionVersion: number; // phải khớp users.session_version hiện tại — Mục 13
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // để Passport tự trả 401 khi token hết hạn
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Được Passport gọi SAU KHI đã verify chữ ký + hạn JWT thành công. Kiểm
   * tra thêm sessionVersion khớp DB hiện tại — nếu user bị đổi
   * role/status sau khi token được cấp, sessionVersion trong DB tăng
   * lên và token cũ (mang version cũ) bị reject ngay, không cần chờ hết
   * hạn (Mục 13). Fail closed: không tìm thấy user, lệch version, hoặc
   * payload kiểu cũ (`roles[]`, thiếu `role`) → 401.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { sessionVersion: true, role: true },
    });
    if (!user || user.sessionVersion !== payload.sessionVersion || user.role !== payload.role) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
