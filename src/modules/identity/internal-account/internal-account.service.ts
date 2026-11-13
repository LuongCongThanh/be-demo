import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, User, UserStatus } from '#src/generated/prisma/client.js';
import { writeUnique } from '#src/infrastructure/database/prisma-error.util.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { AuditLogService } from '#src/infrastructure/audit/audit-log.service.js';
import { PasswordService } from '#src/modules/identity/auth/password.service.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { NEWEST_FIRST, paginate } from '#src/common/pagination/paginate.js';
import { CreateStaffDto } from '#src/modules/identity/internal-account/dto/create-staff.dto.js';
import { UpdateStaffDto } from '#src/modules/identity/internal-account/dto/update-staff.dto.js';
import { StaffResponseDto } from '#src/modules/identity/internal-account/dto/staff-response.dto.js';
import { PaginatedStaffResponseDto } from '#src/modules/identity/internal-account/dto/paginated-staff-response.dto.js';

export interface CreateInternalAccountInput {
  email: string;
  name: string;
  password: string;
  role: 'STAFF' | 'ADMIN';
  /** null = hệ thống (CLI). */
  actorUserId: string | null;
}

export const EMAIL_IN_USE_MESSAGE = 'Email is already in use';
const STAFF_NOT_FOUND = 'Staff account not found';

/**
 * Tài khoản nội bộ (Admin, Staff).
 *
 * `create`: một chỗ duy nhất kiểm email trùng, hash mật khẩu, tạo user và ghi
 * audit trong cùng transaction (Staff qua API, Admin qua CLI). Mật khẩu phải
 * được validate (IsStrongPassword) ở tầng gọi trước khi vào đây.
 *
 * Các hàm `*Staff`: Admin quản lý Staff (identity.md §4, US-1001). Mọi truy
 * vấn lọc `role: STAFF`, nên `:id` của Admin/Khách hàng → 404: endpoint này
 * không bao giờ chạm được vào Tài khoản không phải Staff — nhờ đó bất biến
 * "luôn còn ≥ 1 Admin active" giữ nguyên (không có đường nào vô hiệu hoá Admin).
 */
@Injectable()
export class InternalAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(input: CreateInternalAccountInput): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) {
      throw new ConflictException(EMAIL_IN_USE_MESSAGE);
    }

    const passwordHash = await this.passwordService.hash(input.password);

    return writeUnique(
      () =>
        this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: input.email,
              passwordHash,
              fullName: input.name,
              // Tài khoản nội bộ không có số điện thoại (cột NN dành cho khách) —
              // placeholder cố định giống admin bootstrap trong seed.
              phone: '0000000000',
              role: input.role,
              status: 'ACTIVE',
              // Tài khoản do Admin/hệ thống tạo, không qua bước xác thực email.
              emailVerifiedAt: new Date(),
              // Quyền đến từ Vai trò hệ thống cùng tên loại tài khoản (Staff / Admin), không từ cột `role`.
              userRoles: { create: { role: { connect: { name: input.role === 'ADMIN' ? 'Admin' : 'Staff' } } } },
            },
          });
          await this.auditLog.record(tx, {
            actorUserId: input.actorUserId,
            action: input.role === 'ADMIN' ? 'admin.create' : 'staff.create',
            entityType: 'user',
            entityId: user.id,
            after: { email: user.email, name: user.fullName, role: user.role },
          });
          return user;
        }),
      'email',
      EMAIL_IN_USE_MESSAGE,
    );
  }

  async createStaff(dto: CreateStaffDto, actorUserId: string): Promise<StaffResponseDto> {
    const user = await this.create({ ...dto, role: 'STAFF', actorUserId });
    return toStaffResponse(user);
  }

  async findAllStaff({ page, limit }: PaginationDto): Promise<PaginatedStaffResponseDto> {
    const where: Prisma.UserWhereInput = { role: 'STAFF' };
    const result = await paginate(
      page,
      limit,
      (args) => this.prisma.user.findMany({ where, orderBy: [...NEWEST_FIRST], ...args }),
      () => this.prisma.user.count({ where }),
    );
    return { ...result, data: result.data.map(toStaffResponse) };
  }

  async renameStaff(id: string, dto: UpdateStaffDto, actorUserId: string): Promise<StaffResponseDto> {
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
  async disableStaff(id: string, actorUserId: string): Promise<StaffResponseDto> {
    return this.setStaffStatus(id, 'DISABLED', actorUserId);
  }

  async enableStaff(id: string, actorUserId: string): Promise<StaffResponseDto> {
    return this.setStaffStatus(id, 'ACTIVE', actorUserId);
  }

  private async setStaffStatus(id: string, status: UserStatus, actorUserId: string): Promise<StaffResponseDto> {
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
