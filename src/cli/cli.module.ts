import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from '#src/config/env.validation.js';
import { PrismaModule } from '#src/prisma/prisma.module.js';
import { AuthModule } from '#src/auth/auth.module.js';
import { CreateAdminCommand } from '#src/cli/create-admin.command.js';
import { PasswordPrompt } from '#src/cli/password-prompt.js';

/** Application context cho `src/cli.ts` — không mở HTTP server. */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate }), PrismaModule, AuthModule],
  providers: [CreateAdminCommand, PasswordPrompt],
})
export class CliModule {}
