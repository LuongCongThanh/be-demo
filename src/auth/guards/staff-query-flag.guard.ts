import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Type, mixin } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { JwtPayload } from '../strategies/jwt.strategy.js';

const CATALOG_STAFF_ROLES = ['STORE_MANAGER', 'MASTER_ADMIN'];

// Route public (không token vẫn đọc được) nhưng có 1 query flag mở rộng dữ
// liệu chỉ staff được xem (vd. `includeHidden=true`). Có flag → bắt buộc token
// staff: thiếu token → 401, sai role → 403. Không âm thầm bỏ qua flag: client
// (form edit) phải biết nó không nhận được danh sách đầy đủ.
export function StaffQueryFlagGuard(flag: string): Type<CanActivate> {
  @Injectable()
  class StaffQueryFlagGuardMixin extends AuthGuard('jwt') {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<{ query: Record<string, unknown>; user?: JwtPayload }>();
      if (request.query[flag] !== 'true') {
        return true;
      }
      await super.canActivate(context);
      if (!CATALOG_STAFF_ROLES.some((role) => request.user?.roles.includes(role))) {
        throw new ForbiddenException(`"${flag}" is only available to catalog staff`);
      }
      return true;
    }
  }
  return mixin(StaffQueryFlagGuardMixin);
}
