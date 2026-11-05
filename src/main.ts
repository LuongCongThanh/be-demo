import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '#src/app.module.js';
import { configureApp } from '#src/bootstrap/configure-app.js';
import { setupSwagger } from '#src/bootstrap/setup-swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  setupSwagger(app);

  const configService = app.get(ConfigService);
  await app.listen(configService.get('PORT', 3000));
}
await bootstrap();
