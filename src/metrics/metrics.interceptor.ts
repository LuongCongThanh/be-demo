import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

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
      this.recordRequestMetrics(request.method, route, response.statusCode, start);
    });

    return next.handle();
  }

  private recordRequestMetrics(method: string, route: string, statusCode: number, start: bigint): void {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    this.metrics.recordRequest({ method, route, status_code: String(statusCode) }, durationSeconds);
  }
}
