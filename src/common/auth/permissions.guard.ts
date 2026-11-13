import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '#src/common/auth/permissions.decorator.js';
import type { Permission } from '#src/common/auth/permission.enum.js';
import type { JwtPayload } from '#src/common/auth/jwt-payload.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // route không khai @Authorize(...Permission) → chỉ cần đăng nhập
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;
    if (!user) return false; // phải chạy sau JwtAuthGuard

    // Phải có MỌI Quyền được khai báo. Quyền đến từ access token (tính lúc login/refresh),
    // không đọc database mỗi request; token kiểu cũ thiếu `permissions` bị coi là không có Quyền nào.
    const granted = new Set<string>(user.permissions ?? []);
    return requiredPermissions.every((permission) => granted.has(permission));
  }
}
