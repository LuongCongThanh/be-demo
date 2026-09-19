import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { Observable } from 'rxjs';

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

    // Dùng sự kiện 'finish' của response thay vì tap(next/error) của
    // interceptor: response.statusCode có thể chưa đúng lúc tap() chạy (ví
    // dụ route có @HttpCode(201) nhưng bị ValidationPipe reject — Nest gán
    // sẵn statusCode=201 trước khi handler chạy, và chỉ AllExceptionsFilter
    // (chạy SAU interceptor trong pipeline) mới sửa lại thành 400). Sự kiện
    // 'finish' chỉ fire sau khi response đã thực sự được gửi đi, nên
    // statusCode lúc đó luôn là giá trị cuối cùng, đúng cho cả 2xx lẫn lỗi.
    response.on('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const labels = { method: request.method, route, status_code: String(response.statusCode) };
      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, durationSeconds);
    });

    return next.handle();
  }
}
