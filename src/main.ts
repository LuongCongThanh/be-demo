import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap/configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ecommerce API')
    .setDescription('API NestJS + PostgreSQL (Prisma)')
    .setVersion('1.0')
    .addTag(
      'Authentication & Authorization',
      'Register, email verification, login/refresh/logout, and role/ownership-based access control',
    )
    .addTag('Categories', 'Product category CRUD — writes gated to STORE_MANAGER/MASTER_ADMIN, reads public')
    .addTag(
      'Option Values',
      'Color/size values picked when creating product variants; their codes compose the SKU — writes gated to STORE_MANAGER/MASTER_ADMIN, reads public',
    )
    .addTag(
      'Products',
      'Product aggregate CRUD — variants and images are nested in create/update payloads and embedded in reads; writes gated to STORE_MANAGER/MASTER_ADMIN, reads public',
    )
    .addTag(
      'Upload Images',
      'Presigned direct-to-storage image uploads, reused by any module that needs images — allowed roles depend on the upload purpose',
    )
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const configService = app.get(ConfigService);
  await app.listen(configService.get('PORT', 3000));
}
await bootstrap();
