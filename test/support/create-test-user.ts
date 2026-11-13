import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import type { AccountType, UserStatus } from '#src/generated/prisma/enums.js';

export interface CreateTestUserOptions {
  emailDomain: string;
  emailSuffix: string;
  passwordHash?: string;
  role?: AccountType;
  status?: UserStatus;
  emailVerifiedAt?: Date | null;
}

/**
 * Tạo 1 user test với email random (không đụng user thật giữa các lần chạy).
 * Mặc định `role: CUSTOMER` — dùng chung cho mọi e2e spec dưới `test/`.
 */
export async function createTestUser(prisma: PrismaService, options: CreateTestUserOptions) {
  const email = `${options.emailSuffix}${Date.now()}${Math.random().toString(36).slice(2)}${options.emailDomain}`;

  const accountType = options.role ?? 'CUSTOMER';
  // Quyền đến từ Vai trò hệ thống (migration/seed đã tạo `Admin`, `Staff`), không từ cột `role`.
  const systemRole = { ADMIN: 'Admin', STAFF: 'Staff' }[accountType as string];

  return prisma.user.create({
    data: {
      email,
      passwordHash: options.passwordHash ?? 'irrelevant-for-this-test',
      fullName: 'Nguyen Van A',
      phone: '0912345678',
      role: accountType,
      status: options.status ?? 'ACTIVE',
      emailVerifiedAt: options.emailVerifiedAt,
      ...(systemRole && { userRoles: { create: { role: { connect: { name: systemRole } } } } }),
    },
  });
}
