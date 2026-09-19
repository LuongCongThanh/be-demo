import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { register } from 'prom-client';

@Controller({
  path: 'metrics',
  version: VERSION_NEUTRAL,
})
export class MetricsController {
  @Get()
  @Header('Content-Type', register.contentType)
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
