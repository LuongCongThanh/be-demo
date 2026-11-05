import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap/configure-app.js';
import { setupSwagger } from './bootstrap/setup-swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  setupSwagger(app);

  const configService = app.get(ConfigService);
  await app.listen(configService.get('PORT', 3000));
}
await bootstrap();
