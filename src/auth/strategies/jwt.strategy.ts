import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  roles: string[]; // tên role, vd ['CUSTOMER'] hoặc ['ADMIN'] — không hardcode enum (quyết định #6)
  authorizationVersion: number; // phải khớp users.authorization_version hiện tại — Mục 13
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
   * tra thêm authorizationVersion khớp DB hiện tại — nếu user bị đổi
   * role/status sau khi token được cấp, authorizationVersion trong DB tăng
   * lên và token cũ (mang version cũ) bị reject ngay, không cần chờ hết
   * hạn (Mục 13). Fail closed: không tìm thấy user hoặc lệch version → 401.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { authorizationVersion: true },
    });
    if (!user || user.authorizationVersion !== payload.authorizationVersion) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
