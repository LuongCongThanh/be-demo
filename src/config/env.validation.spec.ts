import { describe, expect, it } from 'vitest';
import { validate } from '#src/config/env.validation.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  ADMIN_BOOTSTRAP_EMAIL: 'admin@example.com',
  ADMIN_BOOTSTRAP_PASSWORD: 'Abcde@123456789',
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

describe('validate() — payment gateway configuration', () => {
  it('keeps gateway credentials optional and treats empty example values as unset', () => {
    const config = validate({
      ...base,
      PUBLIC_API_URL: '',
      VNPAY_TMN_CODE: '',
      VNPAY_HASH_SECRET: '',
      MOMO_PARTNER_CODE: '',
      MOMO_ACCESS_KEY: '',
      MOMO_SECRET_KEY: '',
    });

    expect(config.PUBLIC_API_URL).toBeUndefined();
    expect(config.VNPAY_TMN_CODE).toBeUndefined();
    expect(config.VNPAY_HASH_SECRET).toBeUndefined();
    expect(config.MOMO_PARTNER_CODE).toBeUndefined();
    expect(config.MOMO_ACCESS_KEY).toBeUndefined();
    expect(config.MOMO_SECRET_KEY).toBeUndefined();
  });
});
