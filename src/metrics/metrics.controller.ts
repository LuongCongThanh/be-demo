import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { Registry } from 'prom-client';
import { MetricsService } from './metrics.service.js';

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
