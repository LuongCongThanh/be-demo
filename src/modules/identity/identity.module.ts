import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type ms from 'ms';
import { MailModule } from '#src/infrastructure/mail/mail.module.js';
import { AuditModule } from '#src/infrastructure/audit/audit.module.js';
import { AuthController } from '#src/modules/identity/auth/controllers/storefront/auth.controller.js';
import { MeController } from '#src/modules/identity/auth/controllers/storefront/me.controller.js';
import { AdminStaffController } from '#src/modules/identity/internal-account/controllers/admin/admin-staff.controller.js';
import { RegistrationService } from '#src/modules/identity/auth/services/storefront/registration.service.js';
import { AccessClaimsService } from '#src/modules/identity/auth/services/shared/access-claims.service.js';
import { SessionService } from '#src/modules/identity/auth/services/storefront/session.service.js';
import { PasswordResetService } from '#src/modules/identity/auth/services/storefront/password-reset.service.js';
import { AccountProfileService } from '#src/modules/identity/auth/services/storefront/account-profile.service.js';
import { PasswordService } from '#src/modules/identity/auth/services/shared/password.service.js';
import { TokenService } from '#src/modules/identity/auth/services/shared/token.service.js';
import { AdminRoleController } from '#src/modules/identity/access/controllers/admin/admin-role.controller.js';
import { AccessService } from '#src/modules/identity/access.service.js';
import { InternalAccountService } from '#src/modules/identity/internal-account.service.js';
import { JwtStrategy } from '#src/modules/identity/auth/strategies/jwt.strategy.js';

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
  controllers: [AuthController, MeController, AdminStaffController, AdminRoleController],
  providers: [
    RegistrationService,
    AccessClaimsService,
    SessionService,
    PasswordResetService,
    AccountProfileService,
    PasswordService,
    TokenService,
    JwtStrategy,
    AccessService,
    InternalAccountService,
  ],
  exports: [PassportModule, AccessService, InternalAccountService],
})
export class IdentityModule {}
