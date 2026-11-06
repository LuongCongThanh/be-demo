import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from '#src/infrastructure/observability/metrics/metrics.controller.js';
import { MetricsInterceptor } from '#src/infrastructure/observability/metrics/metrics.interceptor.js';
import { MetricsService } from '#src/infrastructure/observability/metrics/metrics.service.js';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class MetricsModule {}
