import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  roles: string[]; // tên role, vd ['CUSTOMER'] hoặc ['ADMIN'] — không hardcode enum (quyết định #6)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // để Passport tự trả 401 khi token hết hạn
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Được Passport gọi SAU KHI đã verify chữ ký + hạn JWT thành công. Giá trị
   * return ở đây được gắn thẳng vào `request.user`.
   */
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
