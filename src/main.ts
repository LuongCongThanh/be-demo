import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '#src/app.module.js';
import { configureApp } from '#src/bootstrap/configure-app.js';
import { setupSwagger } from '#src/bootstrap/openapi.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  setupSwagger(app);

  const configService = app.get(ConfigService);
  // FE chạy khác origin (vd. localhost:3000) → cần CORS. `credentials: true`
  // để trình duyệt gửi/nhận cookie refresh token. Không set FRONTEND_URL thì
  // không bật CORS (chỉ cho phép same-origin).
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  if (frontendUrl) {
    app.enableCors({ origin: frontendUrl, credentials: true });
  }

  await app.listen(configService.get('PORT', 3000));
}
await bootstrap();
