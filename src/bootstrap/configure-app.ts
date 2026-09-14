import { INestApplication, ValidationPipe } from '@nestjs/common';

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
}
