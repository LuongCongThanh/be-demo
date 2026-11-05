import { describe, expect, it } from 'vitest';
import type { OpenAPIObject } from '@nestjs/swagger';
import { addTooManyRequestsResponse, isSwaggerEnabled } from '#src/bootstrap/setup-swagger.js';

const doc = (): OpenAPIObject => ({
  openapi: '3.0.0',
  info: { title: 't', version: '1' },
  paths: {
    '/a': {
      get: { responses: { '200': { description: 'ok' } } },
      post: { responses: { '429': { description: 'custom' } } },
    },
  },
});

describe('addTooManyRequestsResponse', () => {
  it('adds a 429 ErrorResponseDto response to every operation', () => {
    const result = addTooManyRequestsResponse(doc());
    expect(result.paths['/a'].get?.responses['429']).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponseDto' } } },
    });
  });

  it('keeps a 429 response already declared on the route', () => {
    const result = addTooManyRequestsResponse(doc());
    expect(result.paths['/a'].post?.responses['429']).toEqual({ description: 'custom' });
  });
});

describe('isSwaggerEnabled', () => {
  const config = (env: Record<string, unknown>) => ({ get: (key: string) => env[key] }) as never;

  it.each([
    [{ SWAGGER_ENABLED: true, NODE_ENV: 'production' }, true],
    [{ SWAGGER_ENABLED: false }, false],
    // ConfigService.get() rơi về process.env khi giá trị validated là undefined
    [{ SWAGGER_ENABLED: 'true', NODE_ENV: 'production' }, true],
    [{ SWAGGER_ENABLED: 'false' }, false],
  ])('follows an explicit value %j', (env, expected) => {
    expect(isSwaggerEnabled(config(env))).toBe(expected);
  });

  it.each([undefined, ''])('defaults to on outside production when SWAGGER_ENABLED is %j', (value) => {
    expect(isSwaggerEnabled(config({ SWAGGER_ENABLED: value, NODE_ENV: 'development' }))).toBe(true);
  });

  it.each([undefined, ''])('defaults to off in production when SWAGGER_ENABLED is %j', (value) => {
    expect(isSwaggerEnabled(config({ SWAGGER_ENABLED: value, NODE_ENV: 'production' }))).toBe(false);
  });
});
