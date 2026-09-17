import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { RequestContext } from '../request-context.js';

interface ResolvedError {
  status: number;
  message: string | string[];
}

// Safety net cho MỌI exception (HttpException, Prisma, hay lỗi không lường
// trước) — chuẩn hoá 1 shape response lỗi duy nhất cho toàn app. Không thay
// thế domain error nên ném rõ ràng ở service (xem doc/error-logging-conventions.md
// và doc/api-conventions.md §B5 — pre-check vẫn phải giữ, filter chỉ là lớp
// cuối cùng).
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = RequestContext.getRequestId();
    const { status, message } = this.resolve(exception);

    // Chỉ log lỗi 5xx (không lường trước) — lỗi 4xx (400/401/403/404/409...)
    // là luồng nghiệp vụ dự kiến, log ra sẽ chỉ tạo noise trong log server.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({ statusCode: status, message, requestId });
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : (((body as Record<string, unknown>).message as string | string[] | undefined) ?? exception.message);
      return { status: exception.getStatus(), message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }

  private resolvePrismaError(exception: Prisma.PrismaClientKnownRequestError): ResolvedError {
    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.target as string[] | undefined)?.join(', ');
        return { status: HttpStatus.CONFLICT, message: `Giá trị đã tồn tại cho field: ${target}` };
      }
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Bản ghi đang được tham chiếu bởi dữ liệu khác, không thể thực hiện thao tác',
        };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Record không tồn tại' };
      default:
        return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
    }
  }
}
