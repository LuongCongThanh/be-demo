import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { JwtPayload } from '../strategies/jwt.strategy.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // route không khai @Roles(...) → không giới hạn
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;
    if (!user) return false; // phải chạy sau JwtAuthGuard

    // So khớp string thuần với payload.roles — KHÔNG import enum cố định,
    // vì role là data trong DB (quyết định #6). Thêm role mới (vd STAFF) chỉ
    // cần seed thêm + dùng @Roles('STAFF') ở route mới, không sửa file này.
    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
