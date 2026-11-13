import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '#src/generated/prisma/client.js';
import { ADMIN_ROLE_PERMISSIONS, Permission } from '#src/common/auth/permission.enum.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { paginate } from '#src/common/pagination/paginate.js';
import { writeUnique } from '#src/infrastructure/database/prisma-error.util.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { AuditLogService } from '#src/infrastructure/audit/audit-log.service.js';
import { ADMIN_ROLE_NAME } from '#src/modules/identity/auth/access-claims.service.js';
import { CreateRoleDto } from '#src/modules/identity/access/dto/create-role.dto.js';
import { UpdateRoleDto } from '#src/modules/identity/access/dto/update-role.dto.js';
import { PaginatedRoleResponseDto, RoleResponseDto } from '#src/modules/identity/access/dto/role-response.dto.js';
import { PermissionGroupResponseDto } from '#src/modules/identity/access/dto/permission-group-response.dto.js';
import {
  AccountRolesResponseDto,
  RoleSummaryResponseDto,
} from '#src/modules/identity/access/dto/account-roles-response.dto.js';

export const ROLE_NOT_FOUND = 'Role not found';
export const ACCOUNT_NOT_FOUND = 'Internal account not found';
export const ROLE_NAME_IN_USE = 'Role name is already in use';
export const ADMIN_ROLE_READ_ONLY = 'The Admin role is read-only: it always holds every permission';
export const SYSTEM_ROLE_NOT_RENAMEABLE = 'System roles cannot be renamed';
export const SYSTEM_ROLE_NOT_DELETABLE = 'System roles cannot be deleted';
export const ADMIN_ROLE_ALREADY_ASSIGNED = 'The Admin role is already assigned to another account';
export const SOLE_ADMIN_KEEPS_ROLE = 'The sole active Admin account cannot lose the Admin role';
export const SOLE_ADMIN_NOT_DISABLED = 'The sole active Admin account cannot be disabled';

const ROLE_WITH_PERMISSIONS = {
  permissions: { select: { permission: true } },
  _count: { select: { userRoles: true } },
} satisfies Prisma.RoleInclude;
type RoleRow = Prisma.RoleGetPayload<{ include: typeof ROLE_WITH_PERMISSIONS }>;

const KNOWN_PERMISSIONS: ReadonlySet<string> = new Set(Object.values(Permission));

/**
 * Vai trò, Quyền và việc gán Vai trò cho Tài khoản nội bộ (task 17).
 *
 * Quy tắc chung:
 * - Mọi thay đổi làm đổi Quyền hiệu lực của một Tài khoản (gán/gỡ Vai trò, đổi Quyền hoặc tên Vai trò
 *   đang được gán) chạy trong MỘT `$transaction` cùng với: tăng `session_version` (access token cũ → 401)
 *   và thu hồi refresh token đang hoạt động (`/auth/refresh` không so `session_version`, nên chỉ thu hồi
 *   token mới chặn được việc cấp lại token mang Quyền cũ), rồi ghi audit.
 * - Vai trò `Admin`: read-only, luôn bằng toàn bộ enum, chỉ một Tài khoản giữ, không xoá được.
 * - Vai trò hệ thống không xoá, không đổi tên được (code tra theo tên). `Staff` được sửa Quyền/mô tả.
 * - Xoá Vai trò còn đang được gán: TỪ CHỐI (409), không cascade. Gỡ Vai trò khỏi từng tài khoản là một
 *   thao tác có chủ đích (kèm audit + thu hồi phiên); xoá dây chuyền sẽ âm thầm tước Quyền hàng loạt.
 */
@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Danh sách Quyền (enum) kèm nhóm theo tiền tố, theo thứ tự khai báo trong enum. */
  listPermissions(): PermissionGroupResponseDto[] {
    const groups = new Map<string, Permission[]>();
    for (const permission of Object.values(Permission)) {
      const group = permission.split('_')[0];
      groups.set(group, [...(groups.get(group) ?? []), permission]);
    }
    return [...groups].map(([group, permissions]) => ({ group, permissions }));
  }

  async findAllRoles({ page, limit }: PaginationDto): Promise<PaginatedRoleResponseDto> {
    const result = await paginate(
      page,
      limit,
      (args) => this.prisma.role.findMany({ include: ROLE_WITH_PERMISSIONS, orderBy: [{ name: 'asc' }], ...args }),
      () => this.prisma.role.count(),
    );
    return { ...result, data: result.data.map(toRoleResponse) };
  }

  async findOneRole(id: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({ where: { id }, include: ROLE_WITH_PERMISSIONS });
    if (!role) throw new NotFoundException(ROLE_NOT_FOUND);
    return toRoleResponse(role);
  }

  async createRole(dto: CreateRoleDto, actorUserId: string): Promise<RoleResponseDto> {
    await this.assertNameFree(this.prisma, dto.name);
    return writeUnique(
      () =>
        this.prisma.$transaction(async (tx) => {
          const role = await tx.role.create({
            data: {
              name: dto.name,
              description: dto.description,
              permissions: { createMany: { data: dto.permissions.map((permission) => ({ permission })) } },
            },
            include: ROLE_WITH_PERMISSIONS,
          });
          await this.auditLog.record(tx, {
            actorUserId,
            action: 'role.create',
            entityType: 'role',
            entityId: role.id,
            after: roleSnapshot(role),
          });
          return toRoleResponse(role);
        }),
      'name',
      ROLE_NAME_IN_USE,
    );
  }

  async updateRole(id: string, dto: UpdateRoleDto, actorUserId: string): Promise<RoleResponseDto> {
    return writeUnique(
      () =>
        this.prisma.$transaction(async (tx) => {
          await lockRole(tx, id);
          const before = await findRoleOrThrow(tx, id);
          if (isAdminRole(before)) throw new ConflictException(ADMIN_ROLE_READ_ONLY);

          const renaming = dto.name !== undefined && dto.name !== before.name;
          if (renaming && before.isSystem) throw new ConflictException(SYSTEM_ROLE_NOT_RENAMEABLE);
          if (renaming) await this.assertNameFree(tx, dto.name!, id);

          const beforePermissions = grantedPermissions(before);
          const nextPermissions = dto.permissions ? sortedUnique(dto.permissions) : beforePermissions;
          const permissionsChanged = nextPermissions.join() !== beforePermissions.join();
          const descriptionChanged = dto.description !== undefined && dto.description !== before.description;
          if (!renaming && !permissionsChanged && !descriptionChanged) return toRoleResponse(before);

          await tx.role.update({
            where: { id },
            data: { ...(renaming && { name: dto.name }), ...(descriptionChanged && { description: dto.description }) },
          });
          if (permissionsChanged) {
            await tx.rolePermission.deleteMany({ where: { roleId: id } });
            await tx.rolePermission.createMany({
              data: nextPermissions.map((permission) => ({ roleId: id, permission })),
            });
          }

          // Quyền hoặc tên Vai trò (nằm trong claim `roles`) đổi → mọi tài khoản đang giữ Vai trò phải
          // đăng nhập lại để nhận claim mới.
          let affectedAccountIds: string[] = [];
          if (renaming || permissionsChanged) {
            const holders = await tx.userRole.findMany({ where: { roleId: id }, select: { userId: true } });
            affectedAccountIds = holders.map((h) => h.userId);
            await endSessions(tx, affectedAccountIds);
          }

          const after = await findRoleOrThrow(tx, id);
          await this.auditLog.record(tx, {
            actorUserId,
            action: 'role.update',
            entityType: 'role',
            entityId: id,
            before: roleSnapshot(before),
            after: { ...roleSnapshot(after), sessionsEndedForAccountIds: affectedAccountIds },
          });
          return toRoleResponse(after);
        }),
      'name',
      ROLE_NAME_IN_USE,
    );
  }

  async removeRole(id: string, actorUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockRole(tx, id);
      const role = await findRoleOrThrow(tx, id);
      if (role.isSystem) throw new ConflictException(SYSTEM_ROLE_NOT_DELETABLE);
      if (role._count.userRoles > 0) {
        throw new ConflictException(
          `Role is still assigned to ${role._count.userRoles} account(s); remove it from them first`,
        );
      }
      await tx.role.delete({ where: { id } });
      await this.auditLog.record(tx, {
        actorUserId,
        action: 'role.delete',
        entityType: 'role',
        entityId: id,
        before: roleSnapshot(role),
      });
    });
  }

  async findAccountRoles(accountId: string): Promise<AccountRolesResponseDto> {
    await findInternalAccountOrThrow(this.prisma, accountId);
    return { accountId, roles: await listAccountRoles(this.prisma, accountId) };
  }

  /** Idempotent: tài khoản đã giữ Vai trò thì trả nguyên trạng, không ghi audit, không thu hồi phiên. */
  async assignRole(accountId: string, roleId: string, actorUserId: string): Promise<AccountRolesResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // Khoá Vai trò trước, rồi tài khoản (cùng thứ tự với updateRole/removeRole để không deadlock);
      // khoá Vai trò còn chặn hai request đồng thời cùng gán `Admin` cho hai tài khoản.
      await lockRole(tx, roleId);
      const role = await findRoleOrThrow(tx, roleId);
      await lockUser(tx, accountId);
      await findInternalAccountOrThrow(tx, accountId);

      const held = await listAccountRoles(tx, accountId);
      if (held.some((r) => r.id === roleId)) return { accountId, roles: held };

      if (isAdminRole(role)) {
        const otherHolder = await tx.userRole.findFirst({ where: { roleId, userId: { not: accountId } } });
        if (otherHolder) throw new ConflictException(ADMIN_ROLE_ALREADY_ASSIGNED);
      }

      await tx.userRole.create({ data: { userId: accountId, roleId } });
      await endSessions(tx, [accountId]);
      const roles = await listAccountRoles(tx, accountId);
      await this.auditLog.record(tx, {
        actorUserId,
        action: 'account.role.assign',
        entityType: 'user',
        entityId: accountId,
        before: { roles: held.map((r) => r.name) },
        after: { roles: roles.map((r) => r.name), assigned: role.name },
      });
      return { accountId, roles };
    });
  }

  async removeRoleFromAccount(
    accountId: string,
    roleId: string,
    actorUserId: string,
  ): Promise<AccountRolesResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      await lockRole(tx, roleId);
      const role = await findRoleOrThrow(tx, roleId);
      await lockUser(tx, accountId);
      const account = await findInternalAccountOrThrow(tx, accountId);

      const held = await listAccountRoles(tx, accountId);
      if (!held.some((r) => r.id === roleId)) {
        throw new NotFoundException('The account does not hold this role');
      }

      if (isAdminRole(role) && account.status === 'ACTIVE') {
        const otherActiveAdmin = await tx.userRole.findFirst({
          where: { roleId, userId: { not: accountId }, user: { status: 'ACTIVE' } },
        });
        if (!otherActiveAdmin) throw new ConflictException(SOLE_ADMIN_KEEPS_ROLE);
      }

      await tx.userRole.delete({ where: { userId_roleId: { userId: accountId, roleId } } });
      await endSessions(tx, [accountId]);
      const roles = await listAccountRoles(tx, accountId);
      await this.auditLog.record(tx, {
        actorUserId,
        action: 'account.role.remove',
        entityType: 'user',
        entityId: accountId,
        before: { roles: held.map((r) => r.name) },
        after: { roles: roles.map((r) => r.name), removed: role.name },
      });
      return { accountId, roles };
    });
  }

  /**
   * Gọi từ `InternalAccountService` trong transaction vô hiệu hoá (đã khoá dòng user): tài khoản đang
   * giữ Vai trò `Admin` là Admin duy nhất → không được vô hiệu hoá.
   */
  async assertNotAdminHolder(tx: Prisma.TransactionClient, accountId: string): Promise<void> {
    const holdsAdmin = await tx.userRole.findFirst({
      where: { userId: accountId, role: { name: ADMIN_ROLE_NAME, isSystem: true } },
      select: { userId: true },
    });
    if (holdsAdmin) throw new ConflictException(SOLE_ADMIN_NOT_DISABLED);
  }

  private async assertNameFree(
    db: PrismaService | Prisma.TransactionClient,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await db.role.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId && { id: { not: exceptId } }) },
      select: { id: true },
    });
    if (clash) throw new ConflictException(ROLE_NAME_IN_USE);
  }
}

function isAdminRole(role: { name: string; isSystem: boolean }): boolean {
  return role.isSystem && role.name === ADMIN_ROLE_NAME;
}

function sortedUnique(permissions: readonly Permission[]): Permission[] {
  return [...new Set(permissions)].sort();
}

/** Quyền thực của Vai trò: `Admin` = toàn bộ enum trong code; còn lại đọc DB, bỏ chuỗi lạ. */
function grantedPermissions(role: RoleRow): Permission[] {
  if (isAdminRole(role)) return sortedUnique(ADMIN_ROLE_PERMISSIONS);
  return sortedUnique(
    role.permissions.map((p) => p.permission).filter((p): p is Permission => KNOWN_PERMISSIONS.has(p)),
  );
}

function roleSnapshot(role: RoleRow): Prisma.InputJsonObject {
  return { name: role.name, description: role.description, permissions: grantedPermissions(role) };
}

function toRoleResponse(role: RoleRow): RoleResponseDto {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: grantedPermissions(role),
    accountCount: role._count.userRoles,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

async function findRoleOrThrow(tx: Prisma.TransactionClient, id: string): Promise<RoleRow> {
  const role = await tx.role.findUnique({ where: { id }, include: ROLE_WITH_PERMISSIONS });
  if (!role) throw new NotFoundException(ROLE_NOT_FOUND);
  return role;
}

/** Tài khoản nội bộ = loại STAFF hoặc ADMIN. Khách hàng không có Vai trò RBAC → 404. */
async function findInternalAccountOrThrow(db: Pick<Prisma.TransactionClient, 'user'>, id: string) {
  const user = await db.user.findFirst({
    where: { id, role: { in: ['STAFF', 'ADMIN'] } },
    select: { id: true, status: true },
  });
  if (!user) throw new NotFoundException(ACCOUNT_NOT_FOUND);
  return user;
}

async function listAccountRoles(
  db: Pick<Prisma.TransactionClient, 'userRole'>,
  userId: string,
): Promise<RoleSummaryResponseDto[]> {
  const rows = await db.userRole.findMany({
    where: { userId },
    select: { role: { select: { id: true, name: true, isSystem: true } } },
  });
  return rows.map((r) => r.role).sort((a, b) => a.name.localeCompare(b.name));
}

// UUID hợp lệ đã qua ParseUUIDPipe nên `::uuid` không lỗi cast; dòng không tồn tại → không khoá gì,
// bước `find*OrThrow` ngay sau trả 404.
async function lockRole(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM roles WHERE id = ${id}::uuid FOR UPDATE`;
}

async function lockUser(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
}

/**
 * Kết thúc phiên hiện có của các tài khoản: tăng `session_version` (access token cũ → 401 ở JwtStrategy)
 * và thu hồi refresh token còn hiệu lực (`/auth/refresh` không so `session_version`).
 */
async function endSessions(tx: Prisma.TransactionClient, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await tx.user.updateMany({ where: { id: { in: userIds } }, data: { sessionVersion: { increment: 1 } } });
  await tx.refreshToken.updateMany({
    where: { userId: { in: userIds }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
