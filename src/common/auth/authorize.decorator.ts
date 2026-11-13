import { applyDecorators, UseGuards } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { ApiBearerAuth, DECORATORS } from '@nestjs/swagger';
import type { Permission } from '#src/common/auth/permission.enum.js';
import { JwtAuthGuard } from '#src/common/auth/jwt-auth.guard.js';
import { RequirePermissions } from '#src/common/auth/permissions.decorator.js';
import { PermissionsGuard } from '#src/common/auth/permissions.guard.js';

const METHOD_AUTHORIZE_KEY = 'authorize:method';

/**
 * Cổng phân quyền duy nhất cho controller back-office: xác thực JWT + kiểm Quyền + Swagger bearer.
 * Tài khoản phải có MỌI Quyền được truyền. Không truyền Quyền = chỉ cần đăng nhập. Gắn ở method
 * ghi đè Quyền ở class (`getAllAndOverride`). Kiểm loại tài khoản (vd. chỉ Khách hàng) dùng
 * `@AuthorizeAccountType`, không phải Quyền.
 */
export function Authorize(...permissions: Permission[]): ClassDecorator & MethodDecorator {
  const decorateWithGuardsAndPermissions = applyDecorators(
    ApiBearerAuth(),
    UseGuards(JwtAuthGuard, PermissionsGuard),
    RequirePermissions(...permissions),
  );

  return <T>(target: object, key?: string | symbol, descriptor?: TypedPropertyDescriptor<T>) => {
    if (descriptor) {
      decorateWithGuardsAndPermissions(target, key, descriptor);
      Reflect.defineMetadata(METHOD_AUTHORIZE_KEY, true, descriptor.value as object);
      return;
    }
    decorateWithGuardsAndPermissions(target);
    dropMethodDuplicates(target as { prototype: object });
  };
}

/**
 * Method decorator chạy trước class decorator, nên method-level `@Authorize` đã gắn guard + bearer
 * riêng. Khi class cũng có `@Authorize`, bỏ bản lặp ở method — chỉ giữ Quyền ghi đè — để guard
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
      guards.filter((g) => g !== JwtAuthGuard && g !== PermissionsGuard),
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
