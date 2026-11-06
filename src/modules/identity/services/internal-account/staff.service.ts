import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, User, UserStatus } from '#src/generated/prisma/client.js';
import { PrismaService } from '#src/prisma/prisma.service.js';
import { AuditLogService } from '#src/audit/audit-log.service.js';
import { InternalAccountService } from '#src/modules/identity/services/internal-account/internal-account.service.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { NEWEST_FIRST, paginate } from '#src/common/pagination/paginate.js';
import { CreateStaffDto } from '#src/modules/identity/dto/staff/create-staff.dto.js';
import { UpdateStaffDto } from '#src/modules/identity/dto/staff/update-staff.dto.js';
import { StaffResponseDto } from '#src/modules/identity/dto/staff/staff-response.dto.js';
import { PaginatedStaffResponseDto } from '#src/modules/identity/dto/staff/paginated-staff-response.dto.js';

const STAFF_NOT_FOUND = 'Staff account not found';

/**
 * Admin quản lý Staff (identity.md §4, US-1001). Mọi truy vấn lọc `role:
 * STAFF`, nên `:id` của Admin/Khách hàng → 404: endpoint này không bao giờ
 * chạm được vào Tài khoản không phải Staff.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly internalAccounts: InternalAccountService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateStaffDto, actorUserId: string): Promise<StaffResponseDto> {
    const user = await this.internalAccounts.create({ ...dto, role: 'STAFF', actorUserId });
    return toStaffResponse(user);
  }

  async findAll({ page, limit }: PaginationDto): Promise<PaginatedStaffResponseDto> {
    const where: Prisma.UserWhereInput = { role: 'STAFF' };
    const result = await paginate(
      page,
      limit,
      (args) => this.prisma.user.findMany({ where, orderBy: [...NEWEST_FIRST], ...args }),
      () => this.prisma.user.count({ where }),
    );
    return { ...result, data: result.data.map(toStaffResponse) };
  }

  async rename(id: string, dto: UpdateStaffDto, actorUserId: string): Promise<StaffResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const before = await findStaffOrThrow(tx, id);
      // Tên không đổi → không ghi gì, không có dòng audit rỗng nghĩa.
      if (before.fullName === dto.name) return toStaffResponse(before);
      const user = await tx.user.update({ where: { id }, data: { fullName: dto.name } });
      await this.auditLog.record(tx, {
        actorUserId,
        action: 'staff.rename',
        entityType: 'user',
        entityId: id,
        before: { name: before.fullName },
        after: { name: user.fullName },
      });
      return toStaffResponse(user);
    });
  }

  /**
   * Idempotent: Staff đã DISABLED thì trả nguyên trạng, không ghi audit lần
   * hai. Lần đầu: tăng `session_version` (access token cũ → 401 ngay ở
   * JwtStrategy) và thu hồi mọi refresh token, cùng một transaction.
   */
  async disable(id: string, actorUserId: string): Promise<StaffResponseDto> {
    return this.setStatus(id, 'DISABLED', actorUserId);
  }

  async enable(id: string, actorUserId: string): Promise<StaffResponseDto> {
    return this.setStatus(id, 'ACTIVE', actorUserId);
  }

  private async setStatus(id: string, status: UserStatus, actorUserId: string): Promise<StaffResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // Khoá dòng để 2 request disable/enable đồng thời không cùng thấy trạng
      // thái cũ rồi cùng ghi audit.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await findStaffOrThrow(tx, id);
      if (current.status === status) {
        return toStaffResponse(current);
      }

      const disabling = status === 'DISABLED';
      const user = await tx.user.update({
        where: { id },
        data: { status, ...(disabling && { sessionVersion: { increment: 1 } }) },
      });
      if (disabling) {
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await this.auditLog.record(tx, {
        actorUserId,
        action: disabling ? 'staff.disable' : 'staff.enable',
        entityType: 'user',
        entityId: id,
        before: { status: current.status },
        after: { status: user.status },
      });
      return toStaffResponse(user);
    });
  }
}

async function findStaffOrThrow(tx: Prisma.TransactionClient, id: string): Promise<User> {
  const user = await tx.user.findFirst({ where: { id, role: 'STAFF' } });
  if (!user) {
    throw new NotFoundException(STAFF_NOT_FOUND);
  }
  return user;
}

function toStaffResponse(user: User): StaffResponseDto {
  return {
    id: user.id,
    email: user.email,
    name: user.fullName,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
