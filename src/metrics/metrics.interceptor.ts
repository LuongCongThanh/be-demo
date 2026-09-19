import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const start = process.hrtime.bigint();
    const route = request.route?.path ?? request.url;

    return next.handle().pipe(
      tap(() => {
        const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
        const labels = { method: request.method, route, status_code: String(response.statusCode) };
        httpRequestsTotal.inc(labels);
        httpRequestDurationSeconds.observe(labels, durationSeconds);
      }),
    );
  }
}
