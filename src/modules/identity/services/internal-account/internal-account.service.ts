import { ConflictException, Injectable } from '@nestjs/common';
import type { User } from '#src/generated/prisma/client.js';
import { writeUnique } from '#src/infrastructure/database/prisma-error.util.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { AuditLogService } from '#src/infrastructure/audit/audit-log.service.js';
import { PasswordService } from '#src/modules/identity/services/auth/password.service.js';

export interface CreateInternalAccountInput {
  email: string;
  name: string;
  password: string;
  role: 'STAFF' | 'ADMIN';
  /** null = hệ thống (CLI). */
  actorUserId: string | null;
}

export const EMAIL_IN_USE_MESSAGE = 'Email is already in use';

/**
 * Tạo Tài khoản nội bộ (Staff qua API, Admin qua CLI) — một chỗ duy nhất kiểm
 * email trùng, hash mật khẩu, tạo user và ghi audit trong cùng transaction.
 * Mật khẩu phải được validate (IsStrongPassword) ở tầng gọi trước khi vào đây.
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
}
