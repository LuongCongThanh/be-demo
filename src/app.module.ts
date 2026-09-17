import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default cho mọi route không khai @Throttle() riêng — 20 request/phút/IP
    // (quyết định #11, doc/auth-playbook/00-overview.md).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 20 }]),
    PrismaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // `useExisting` (not `useClass`) so `ThrottlerGuard` is also reachable as
    // its own overridable provider — APP_GUARD is a `multi: true` token, so
    // `overrideProvider(APP_GUARD)` in e2e tests would only ADD a stub guard
    // alongside the real one instead of replacing it. Overriding the
    // `ThrottlerGuard` class token directly (what this indirection enables)
    // is what actually disables it in tests that aren't testing rate
    // limiting itself (see test/support/create-test-app.ts).
    ThrottlerGuard,
    { provide: APP_GUARD, useExisting: ThrottlerGuard },
  ],
})
export class AppModule {}
