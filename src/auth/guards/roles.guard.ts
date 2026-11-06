import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '#src/auth/decorators/roles.decorator.js';
import type { Role } from '#src/generated/prisma/enums.js';
import { JwtPayload } from '#src/modules/identity/strategies/jwt.strategy.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // route không khai @Roles(...) → không giới hạn
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;
    if (!user) return false; // phải chạy sau JwtAuthGuard

    // So khớp chính xác, không suy cây phân cấp (ADR 0005): route nào cho
    // ADMIN và STAFF thì phải khai cả hai trong @Roles(...).
    return requiredRoles.includes(user.role);
  }
}
