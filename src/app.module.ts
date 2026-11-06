import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '#src/prisma/prisma.module.js';
import { IdentityModule } from '#src/modules/identity/identity.module.js';
import { HealthModule } from '#src/health/health.module.js';
import { MetricsModule } from '#src/metrics/metrics.module.js';
import { CatalogModule } from '#src/modules/catalog/catalog.module.js';
import { validate } from '#src/config/env.validation.js';
import { AllExceptionsFilter } from '#src/common/filters/all-exceptions.filter.js';
import { RequestIdMiddleware } from '#src/common/middleware/request-id.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    // Default cho mọi route không khai @Throttle() riêng — 20 request/phút/IP
    // (quyết định #11, docs/auth-playbook/00-overview.md).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 20 }]),
    PrismaModule,
    IdentityModule,
    HealthModule,
    MetricsModule,
    CatalogModule,
  ],
  providers: [
    // `useExisting` (not `useClass`) so `ThrottlerGuard` is also reachable as
    // its own overridable provider — APP_GUARD is a `multi: true` token, so
    // `overrideProvider(APP_GUARD)` in e2e tests would only ADD a stub guard
    // alongside the real one instead of replacing it. Overriding the
    // `ThrottlerGuard` class token directly (what this indirection enables)
    // is what actually disables it in tests that aren't testing rate
    // limiting itself (see test/support/create-test-app.ts).
    ThrottlerGuard,
    { provide: APP_GUARD, useExisting: ThrottlerGuard },
    // Cùng lý do `useExisting` như trên — APP_FILTER cũng là token multi:
    // true (xem docs/convention/error-logging-conventions.md).
    AllExceptionsFilter,
    { provide: APP_FILTER, useExisting: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
