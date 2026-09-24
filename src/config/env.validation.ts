import { Transform, plainToInstance } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';
import { IsStrongPassword } from '../auth/decorators/is-strong-password.decorator.js';

// class-validator's `@IsOptional()` only skips null/undefined, not an empty
// string — an optional numeric env var left blank (as .env.example does)
// would otherwise fail `@IsInt()`/`@Min()` instead of being treated as unset.
const emptyStringToUndefined = () => Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value));

// Biến bắt buộc: thiếu là app không chạy đúng được, nên không có `@IsOptional()`.
// Biến optional: nơi gọi `ConfigService.get(key, default)` đã tự lo default,
// class này chỉ đảm bảo NẾU được set thì đúng kiểu/format.
export class EnvironmentVariables {
  @IsString()
  @MinLength(1)
  DATABASE_URL: string;

  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET quá ngắn để an toàn — dùng chuỗi random ít nhất 32 ký tự' })
  JWT_ACCESS_SECRET: string;

  @IsEmail()
  ADMIN_BOOTSTRAP_EMAIL: string;

  @IsStrongPassword()
  ADMIN_BOOTSTRAP_PASSWORD: string;

  @emptyStringToUndefined()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL?: string;

  @IsOptional()
  @IsString()
  REFRESH_TOKEN_TTL?: string;

  @IsOptional()
  @IsString()
  REFRESH_TOKEN_COOKIE_NAME?: string;

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @emptyStringToUndefined()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT?: number;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsOptional()
  @IsString()
  SMTP_FROM?: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  @IsString()
  @MinLength(1)
  S3_ENDPOINT: string;

  // Optional: endpoint client truy cập được, khi khác S3_ENDPOINT (backend gọi
  // storage qua mạng nội bộ). Bỏ trống = dùng S3_ENDPOINT.
  @IsOptional()
  @IsString()
  S3_PUBLIC_ENDPOINT?: string;

  @IsString()
  @MinLength(1)
  S3_BUCKET: string;

  @IsString()
  @MinLength(1)
  S3_REGION: string;

  @IsString()
  @MinLength(1)
  S3_ACCESS_KEY_ID: string;

  @IsString()
  @MinLength(1)
  S3_SECRET_ACCESS_KEY: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const message = errors.map((error) => Object.values(error.constraints ?? {}).join(', ')).join('; ');
    throw new Error(`Biến môi trường không hợp lệ — kiểm tra lại .env: ${message}`);
  }

  return validated;
}
