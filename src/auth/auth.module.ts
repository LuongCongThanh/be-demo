import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type ms from 'ms';
import { MailModule } from '#src/mail/mail.module.js';
import { AuthController } from '#src/auth/auth.controller.js';
import { AuthService } from '#src/auth/services/auth.service.js';
import { PasswordService } from '#src/auth/services/password.service.js';
import { TokenService } from '#src/auth/services/token.service.js';
import { AuditModule } from '#src/audit/audit.module.js';
import { MeController } from '#src/auth/me.controller.js';
import { InternalAccountService } from '#src/auth/services/internal-account.service.js';
import { JwtStrategy } from '#src/auth/strategies/jwt.strategy.js';

@Module({
  imports: [
    MailModule,
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET');
        // Fail fast lúc app boot thay vì để JwtService.sign()/verify() lỗi
        // khó hiểu ở request đầu tiên nếu env thiếu secret.
        if (!secret) {
          throw new Error('JWT_ACCESS_SECRET is not set — required to sign/verify access tokens');
        }
        return {
          secret,
          signOptions: { expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') as ms.StringValue },
        };
      },
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [AuthService, PasswordService, TokenService, JwtStrategy, InternalAccountService],
  exports: [PassportModule, InternalAccountService],
})
export class AuthModule {}
