import { describe, expect, it } from 'vitest';
import { validate } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  ADMIN_BOOTSTRAP_EMAIL: 'admin@example.com',
  ADMIN_BOOTSTRAP_PASSWORD: 'Abc@12345678',
};

describe('validate() — SWAGGER_ENABLED', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])("parses '%s' as %s", (raw, expected) => {
    expect(validate({ ...base, SWAGGER_ENABLED: raw }).SWAGGER_ENABLED).toBe(expected);
  });

  it.each([undefined, ''])('treats %j as unset', (raw) => {
    expect(validate({ ...base, SWAGGER_ENABLED: raw }).SWAGGER_ENABLED).toBeUndefined();
  });

  it.each(['yes', '1', 'TRUE'])("rejects '%s'", (raw) => {
    expect(() => validate({ ...base, SWAGGER_ENABLED: raw })).toThrow(/SWAGGER_ENABLED/);
  });
});
