import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { AccountType } from '#src/generated/prisma/enums.js';
import { AccountTypeGuard, RequireAccountTypes } from '#src/common/auth/account-type.guard.js';
import { JwtAuthGuard } from '#src/common/auth/jwt-auth.guard.js';

/**
 * Xác thực JWT + chỉ cho đúng loại tài khoản (vd. `@AuthorizeAccountType('CUSTOMER')` cho route
 * mua hàng của Khách hàng). Không cấp/kiểm Quyền back-office; dùng ở method, không trộn với
 * `@Authorize(...)` cùng cấp.
 */
export function AuthorizeAccountType(...types: AccountType[]) {
  return applyDecorators(ApiBearerAuth(), UseGuards(JwtAuthGuard, AccountTypeGuard), RequireAccountTypes(...types));
}
