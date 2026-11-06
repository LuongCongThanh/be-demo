import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Registry } from 'prom-client';
import { MetricsService } from '#src/metrics/metrics.service.js';

// Endpoint hạ tầng cho Prometheus scrape, không phải API cho client — ẩn khỏi Swagger.
@ApiExcludeController()
@Controller({
  path: 'metrics',
  version: VERSION_NEUTRAL,
})
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', Registry.PROMETHEUS_CONTENT_TYPE)
  async metrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
