import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

interface RequestLabels {
  method: string;
  route: string;
  status_code: string;
}

/**
 * Sở hữu registry + metric riêng (không dùng `prom-client`'s default global
 * register) để có thể inject qua DI như mọi provider khác trong codebase, và
 * để mỗi lần bootstrap app (vd. mỗi test file dựng app riêng) có registry độc
 * lập — tránh lỗi "metric đã được đăng ký" nếu app được khởi tạo nhiều lần
 * trong cùng một module registry.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  private readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });

  private readonly httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency in seconds',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });

  recordRequest(labels: RequestLabels, durationSeconds: number): void {
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
