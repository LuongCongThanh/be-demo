import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppLogger } from '../common/app-logger.js';

/**
 * Shared app configuration used by both `main.ts` and e2e test setup, so the
 * two never drift apart (see doc/api-conventions.md §B8).
 */
export function configureApp(app: INestApplication) {
  // Đăng ký logger toàn cục có gắn request-id — mọi `new Logger(X.name)` sẵn
  // có trong codebase tự động dùng logger này, không cần sửa từng chỗ (xem
  // doc/error-logging-conventions.md).
  app.useLogger(new AppLogger());

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api', { exclude: ['metrics'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Express không tự parse cookie — cần middleware này để request.cookies có
  // giá trị (dùng ở /auth/refresh, /auth/logout để đọc refresh token).
  app.use(cookieParser());
}
