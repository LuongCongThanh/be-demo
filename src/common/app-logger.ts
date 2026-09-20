import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { RequestContext } from './request-context.js';

// Đăng ký qua `app.useLogger(new AppLogger())` trong main.ts — mọi
// `new Logger(ClassName.name)` sẵn có trong codebase tự động dùng logger này
// (NestJS route instance Logger qua logger đã đăng ký toàn cục), không cần
// sửa từng chỗ gọi log. Xem docs/convention/error-logging-conventions.md.
//
// Override `stringifyMessage` (không phải log/error/warn/...) vì đây là điểm
// duy nhất Nest gọi để format message thành text cho MỌI kiểu message (string,
// Error, object, ...) và cho MỌI log level — bao gồm cả `fatal`. Wrap ở từng
// method log() như trước chỉ hoạt động khi message là string, bỏ sót Error/object.
export class AppLogger extends ConsoleLogger {
  protected override stringifyMessage(message: unknown, logLevel: LogLevel): unknown {
    const formatted = super.stringifyMessage(message, logLevel);
    const requestId = RequestContext.getRequestId();
    return requestId ? `[${requestId}] ${formatted}` : formatted;
  }
}
