import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma-health.indicator.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  // Luôn 200 nếu process còn nhận request — không check dependency nào.
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  // Chỉ phụ thuộc Postgres (ADR 0008) — Redis down không làm route này 503.
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.prismaHealth.isHealthy()]);
  }
}
