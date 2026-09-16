import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/**
 * Shared app configuration used by both `main.ts` and e2e test setup, so the
 * two never drift apart (see doc/api-conventions.md §8).
 */
export function configureApp(app: INestApplication) {
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
