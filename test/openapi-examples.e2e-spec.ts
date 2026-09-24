import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/create-test-app.js';

type SchemaObject = {
  $ref?: string;
  allOf?: SchemaObject[];
  items?: SchemaObject;
  example?: unknown;
  properties?: Record<string, SchemaObject>;
};

// Field chỉ trỏ tới schema khác (object lồng, mảng object) — ví dụ nằm ở
// chính schema được trỏ tới, không lặp lại ở đây.
function isReference(schema: SchemaObject): boolean {
  return Boolean(schema.$ref || schema.allOf?.some((s) => s.$ref) || schema.items?.$ref);
}

// Swagger là tài liệu cho FE — mọi field request/response đều phải có dữ liệu
// mẫu (docs/convention/api-conventions.md). Test đọc chính OpenAPI document mà
// /docs phục vụ, nên field mới quên `example` sẽ đỏ ở đây.
describe('OpenAPI examples (e2e)', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
  });

  afterAll(async () => {
    await app.close();
  });

  it('every schema property has an example', () => {
    const missing = Object.entries(document.components?.schemas ?? {}).flatMap(([name, schema]) =>
      Object.entries((schema as SchemaObject).properties ?? {})
        .filter(([, property]) => !isReference(property) && property.example === undefined)
        .map(([property]) => `${name}.${property}`),
    );

    expect(missing).toEqual([]);
  });

  it('every query parameter has an example', () => {
    const missing = Object.entries(document.paths).flatMap(([path, item]) =>
      Object.entries(item).flatMap(([method, operation]) =>
        (
          (operation as { parameters?: { in: string; name: string; example?: unknown; schema?: SchemaObject }[] })
            .parameters ?? []
        )
          .filter((p) => p.in === 'query' && p.example === undefined && p.schema?.example === undefined)
          .map((p) => `${method.toUpperCase()} ${path} ?${p.name}`),
      ),
    );

    expect(missing).toEqual([]);
  });
});
