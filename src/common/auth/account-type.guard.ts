import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AccountType } from '#src/generated/prisma/enums.js';
import type { JwtPayload } from '#src/common/auth/jwt-payload.js';

export const ACCOUNT_TYPES_KEY = 'accountTypes';
export const RequireAccountTypes = (...types: AccountType[]) => SetMetadata(ACCOUNT_TYPES_KEY, types);

/** Kiểm loại tài khoản (CUSTOMER / STAFF / ADMIN) từ JWT — tách biệt với Quyền back-office. */
@Injectable()
export class AccountTypeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<AccountType[]>(ACCOUNT_TYPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed || allowed.length === 0) return true;

    const user: JwtPayload | undefined = context.switchToHttp().getRequest().user;
    return !!user && allowed.includes(user.role);
  }
}
