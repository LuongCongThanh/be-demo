import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from '#src/infrastructure/observability/health/health.controller.js';
import { PrismaHealthIndicator } from '#src/infrastructure/observability/health/prisma-health.indicator.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
})
export class HealthModule {}
