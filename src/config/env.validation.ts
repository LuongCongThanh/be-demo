import { plainToInstance } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

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

  @IsString()
  @MinLength(1)
  ADMIN_BOOTSTRAP_PASSWORD: string;

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

  @IsOptional()
  @IsInt()
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
