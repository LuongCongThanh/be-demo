import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule, getSchemaPath } from '@nestjs/swagger';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { ErrorResponseDto } from '#src/common/swagger/error-response.dto.js';

/** UI ở `/docs`, spec JSON ở `/docs-json` (ADR 0002). */
export const SWAGGER_PATH = 'docs';

export function setupSwagger(app: INestApplication) {
  if (!isSwaggerEnabled(app.get(ConfigService))) return;
  SwaggerModule.setup(SWAGGER_PATH, app, buildOpenApiDocument(app));
}

/**
 * Dựng document OpenAPI từ app. Dùng chung cho Swagger UI và
 * `scripts/write-openapi.ts` (hợp đồng phát hành theo tag) để hai nơi không lệch nhau.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('Ecommerce API')
    .setDescription('API NestJS + PostgreSQL (Prisma)')
    .setVersion('1.0')
    .addBearerAuth();
  for (const tag of Object.values(API_TAGS)) builder.addTag(tag.name, tag.description);

  const document = SwaggerModule.createDocument(app, builder.build(), { extraModels: [ErrorResponseDto] });
  return addTooManyRequestsResponse(document);
}

/**
 * `SWAGGER_ENABLED` set rõ thì theo nó; bỏ trống/không có thì bật trừ khi
 * production. Không dùng default của `ConfigService.get()`: khi validator trả
 * `undefined` (giá trị rỗng), `get()` rơi về `process.env` và nhận lại chuỗi
 * `''` — default không bao giờ được áp và Swagger bị tắt nhầm.
 */
export function isSwaggerEnabled(configService: Pick<ConfigService, 'get'>): boolean {
  const value: unknown = configService.get('SWAGGER_ENABLED');
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return configService.get('NODE_ENV') !== 'production';
}

/**
 * `ThrottlerGuard` là APP_GUARD toàn cục (app.module.ts) nên MỌI route đều có
 * thể trả 429 — khai 1 lần ở đây thay vì gắn decorator vào từng route.
 */
export function addTooManyRequestsResponse(document: OpenAPIObject): OpenAPIObject {
  for (const pathItem of Object.values(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = pathItem[method];
      if (!operation) continue;
      operation.responses['429'] ??= {
        description: 'Rate limit exceeded — retry after the window resets',
        content: { 'application/json': { schema: { $ref: getSchemaPath(ErrorResponseDto) } } },
      };
    }
  }
  return document;
}
