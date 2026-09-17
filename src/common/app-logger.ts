import { ConsoleLogger } from '@nestjs/common';
import { RequestContext } from './request-context.js';

// Đăng ký qua `app.useLogger(new AppLogger())` trong main.ts — mọi
// `new Logger(ClassName.name)` sẵn có trong codebase tự động dùng logger này
// (NestJS route instance Logger qua logger đã đăng ký toàn cục), không cần
// sửa từng chỗ gọi log. Xem doc/error-logging-conventions.md.
export class AppLogger extends ConsoleLogger {
  private withRequestId(message: unknown): unknown {
    const requestId = RequestContext.getRequestId();
    if (!requestId || typeof message !== 'string') {
      return message;
    }
    return `[${requestId}] ${message}`;
  }

  override log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(this.withRequestId(message), ...optionalParams);
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(this.withRequestId(message), ...optionalParams);
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(this.withRequestId(message), ...optionalParams);
  }

  override debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(this.withRequestId(message), ...optionalParams);
  }

  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose(this.withRequestId(message), ...optionalParams);
  }
}
