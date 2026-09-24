import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

// Cờ boolean trên query string: chỉ đúng chuỗi "true" mới là bật. Dùng chung
// cho DTO (QueryFlag) và StaffQueryFlagGuard để hai nơi không hiểu cờ khác nhau.
export function isQueryFlagSet(query: Record<string, unknown>, flag: string): boolean {
  return query[flag] === 'true';
}

// Đọc từ `obj` (query thô) thay vì `value`: `value` có thể đã bị ép kiểu, và
// Boolean('false') là true.
export function QueryFlag(flag: string): PropertyDecorator {
  return applyDecorators(
    IsOptional(),
    Transform(({ obj }: { obj: Record<string, unknown> }) => isQueryFlagSet(obj, flag)),
    IsBoolean(),
  );
}
