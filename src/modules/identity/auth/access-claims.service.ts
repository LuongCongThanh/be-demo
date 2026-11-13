import { Injectable } from '@nestjs/common';
import { ADMIN_ROLE_PERMISSIONS, Permission } from '#src/common/auth/permission.enum.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';

export const ADMIN_ROLE_NAME = 'Admin';

export interface AccessClaims {
  roles: string[];
  permissions: Permission[];
}

const KNOWN_PERMISSIONS: ReadonlySet<string> = new Set(Object.values(Permission));

/**
 * Tính Vai trò + Quyền của một Tài khoản để đưa vào access token (lúc login / refresh).
 * Quyền = hợp Quyền của các Vai trò được gán (`user_roles` → `role_permissions`). Vai trò hệ thống
 * `Admin` luôn bằng toàn bộ enum `Permission` trong code, không phụ thuộc hàng DB. Chuỗi Quyền
 * lạ trong DB (không còn trong enum) bị bỏ.
 */
@Injectable()
export class AccessClaimsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(user: { id: string; role: string }): Promise<AccessClaims> {
    // Khách hàng không có Vai trò RBAC — khỏi đọc DB.
    if (user.role === 'CUSTOMER') return { roles: [], permissions: [] };

    const assignments = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      select: { role: { select: { name: true, isSystem: true, permissions: { select: { permission: true } } } } },
    });

    const roles = assignments.map((a) => a.role.name).sort();
    const permissions = new Set<Permission>();
    for (const { role } of assignments) {
      const granted =
        role.isSystem && role.name === ADMIN_ROLE_NAME
          ? ADMIN_ROLE_PERMISSIONS
          : role.permissions.map((p) => p.permission).filter((p): p is Permission => KNOWN_PERMISSIONS.has(p));
      for (const permission of granted) permissions.add(permission);
    }
    return { roles, permissions: [...permissions].sort() };
  }
}
