import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type ms from 'ms';
import { MailModule } from '#src/infrastructure/mail/mail.module.js';
import { AuditModule } from '#src/infrastructure/audit/audit.module.js';
import { AuthController } from '#src/modules/identity/controllers/storefront/auth.controller.js';
import { MeController } from '#src/modules/identity/controllers/storefront/me.controller.js';
import { AdminStaffController } from '#src/modules/identity/controllers/back-office/admin-staff.controller.js';
import { AuthService } from '#src/modules/identity/services/auth/auth.service.js';
import { PasswordService } from '#src/modules/identity/services/auth/password.service.js';
import { TokenService } from '#src/modules/identity/services/auth/token.service.js';
import { InternalAccountService } from '#src/modules/identity/services/internal-account/internal-account.service.js';
import { StaffService } from '#src/modules/identity/services/internal-account/staff.service.js';
import { JwtStrategy } from '#src/modules/identity/strategies/jwt.strategy.js';

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
  controllers: [AuthController, MeController, AdminStaffController],
  providers: [AuthService, PasswordService, TokenService, JwtStrategy, InternalAccountService, StaffService],
  exports: [PassportModule, InternalAccountService],
})
export class IdentityModule {}
