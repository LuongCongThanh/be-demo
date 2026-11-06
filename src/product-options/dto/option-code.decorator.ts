import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

/** Mã size/màu: in hoa, số, gạch nối — khớp CHECK `^[A-Z0-9-]+$` trong DB. */
export function IsOptionCode(example: string) {
  return applyDecorators(
    ApiProperty({ maxLength: 30, pattern: '^[A-Z0-9-]+$', example }),
    IsString(),
    MaxLength(30),
    Matches(/^[A-Z0-9-]+$/, { message: 'code must contain only uppercase letters, digits and hyphens' }),
  );
}
