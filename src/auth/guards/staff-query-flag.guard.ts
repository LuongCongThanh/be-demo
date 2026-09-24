import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Type, mixin } from '@nestjs/common';
import type { JwtPayload } from '../strategies/jwt.strategy.js';
import { CATALOG_STAFF_ROLES } from '../decorators/roles.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { isQueryFlagSet } from '../../common/query-flag.js';

// Route public (không token vẫn đọc được) nhưng có 1 query flag mở rộng dữ
// liệu chỉ staff được xem (vd. `includeHidden=true`). Có flag → bắt buộc token
// staff: thiếu token → 401 (JwtAuthGuard), sai role → 403. Không dùng được
// RolesGuard vì route public không khai @Roles(). Không âm thầm bỏ qua flag: client
// (form edit) phải biết nó không nhận được danh sách đầy đủ.
export function StaffQueryFlagGuard(flag: string): Type<CanActivate> {
  @Injectable()
  class StaffQueryFlagGuardMixin extends JwtAuthGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<{ query: Record<string, unknown>; user?: JwtPayload }>();
      if (!isQueryFlagSet(request.query, flag)) {
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
