import type { AccountType } from '#src/generated/prisma/enums.js';
import type { Permission } from '#src/common/auth/permission.enum.js';

/** Payload JWT đã được JwtStrategy (modules/identity) xác thực, gắn vào request.user. */
export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: AccountType; // loại tài khoản (CUSTOMER / STAFF / ADMIN), không phải Vai trò RBAC
  roles: string[]; // tên các Vai trò RBAC của Tài khoản nội bộ (Khách hàng: rỗng)
  permissions: Permission[]; // hợp Quyền của các Vai trò; tính lúc login/refresh, không đọc DB mỗi request
  sessionVersion: number; // phải khớp users.session_version hiện tại — Mục 13
}
