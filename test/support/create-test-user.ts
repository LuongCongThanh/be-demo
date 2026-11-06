import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import type { Role, UserStatus } from '#src/generated/prisma/enums.js';

export interface CreateTestUserOptions {
  emailDomain: string;
  emailSuffix: string;
  passwordHash?: string;
  role?: Role;
  status?: UserStatus;
  emailVerifiedAt?: Date | null;
}

/**
 * Tạo 1 user test với email random (không đụng user thật giữa các lần chạy).
 * Mặc định `role: CUSTOMER` — dùng chung cho mọi e2e spec dưới `test/`.
 */
export async function createTestUser(prisma: PrismaService, options: CreateTestUserOptions) {
  const email = `${options.emailSuffix}${Date.now()}${Math.random().toString(36).slice(2)}${options.emailDomain}`;

  return prisma.user.create({
    data: {
      email,
      passwordHash: options.passwordHash ?? 'irrelevant-for-this-test',
      fullName: 'Nguyen Van A',
      phone: '0912345678',
      role: options.role ?? 'CUSTOMER',
      status: options.status ?? 'ACTIVE',
      emailVerifiedAt: options.emailVerifiedAt,
    },
  });
}
