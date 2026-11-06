import { applyDecorators, UseGuards } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { ApiBearerAuth, DECORATORS } from '@nestjs/swagger';
import type { Role } from '#src/generated/prisma/enums.js';
import { JwtAuthGuard } from '#src/common/auth/jwt-auth.guard.js';
import { Roles } from '#src/common/auth/roles.decorator.js';
import { RolesGuard } from '#src/common/auth/roles.guard.js';

const METHOD_AUTHORIZE_KEY = 'authorize:method';

/**
 * Cổng phân quyền duy nhất cho controller: xác thực JWT + kiểm vai trò + Swagger bearer.
 * Không truyền vai trò = chỉ cần đăng nhập. Gắn ở method ghi đè vai trò ở class
 * (`getAllAndOverride`). So khớp chính xác, không suy cây phân cấp (ADR 0005).
 */
export function Authorize(...roles: Role[]): ClassDecorator & MethodDecorator {
  const decorateWithGuardsAndRoles = applyDecorators(
    ApiBearerAuth(),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...roles),
  );

  return <T>(target: object, key?: string | symbol, descriptor?: TypedPropertyDescriptor<T>) => {
    if (descriptor) {
      decorateWithGuardsAndRoles(target, key, descriptor);
      Reflect.defineMetadata(METHOD_AUTHORIZE_KEY, true, descriptor.value as object);
      return;
    }
    decorateWithGuardsAndRoles(target);
    dropMethodDuplicates(target as { prototype: object });
  };
}

/**
 * Method decorator chạy trước class decorator, nên method-level `@Authorize` đã gắn guard + bearer
 * riêng. Khi class cũng có `@Authorize`, bỏ bản lặp ở method — chỉ giữ vai trò ghi đè — để guard
 * (và truy vấn DB trong JwtStrategy) không chạy hai lần và OpenAPI không lặp `bearer`.
 */
function dropMethodDuplicates(cls: { prototype: object }) {
  for (const name of Object.getOwnPropertyNames(cls.prototype)) {
    const method: unknown = Reflect.get(cls.prototype, name);
    if (typeof method !== 'function' || !Reflect.getMetadata(METHOD_AUTHORIZE_KEY, method)) continue;

    const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, method) ?? [];
    setOrDelete(
      GUARDS_METADATA,
      method,
      guards.filter((g) => g !== JwtAuthGuard && g !== RolesGuard),
    );

    const security: Record<string, unknown>[] = Reflect.getMetadata(DECORATORS.API_SECURITY, method) ?? [];
    const bearerIndex = security.findIndex((s) => Object.keys(s).length === 1 && 'bearer' in s);
    setOrDelete(DECORATORS.API_SECURITY, method, security.toSpliced(bearerIndex, bearerIndex >= 0 ? 1 : 0));
  }
}

/** Mảng rỗng phải xoá hẳn key: Swagger sẽ in `security: []` (route công khai) nếu để lại. */
function setOrDelete(key: string, target: object, values: unknown[]) {
  if (values.length > 0) Reflect.defineMetadata(key, values, target);
  else Reflect.deleteMetadata(key, target);
}
