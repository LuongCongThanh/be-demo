import { PrismaService } from '@src/prisma/prisma.service.js';

export interface CreateTestUserOptions {
  emailDomain: string;
  emailSuffix: string;
  passwordHash?: string;
  status?: 'ACTIVE' | 'BLOCKED';
  emailVerifiedAt?: Date | null;
}

/**
 * Tạo 1 user test với email random (không đụng user thật giữa các lần chạy)
 * và gắn sẵn role CUSTOMER — dùng chung cho mọi e2e spec dưới `test/`.
 *
 * Role CUSTOMER phải tồn tại trước (thường upsert 1 lần ở `beforeAll` của
 * từng spec); hàm này chỉ lookup, không tự tạo role.
 */
export async function createTestUser(prisma: PrismaService, options: CreateTestUserOptions) {
  const email = `${options.emailSuffix}${Date.now()}${Math.random().toString(36).slice(2)}${options.emailDomain}`;
  const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CUSTOMER' } });

  return prisma.user.create({
    data: {
      email,
      passwordHash: options.passwordHash ?? 'irrelevant-for-this-test',
      fullName: 'Nguyen Van A',
      phone: '0912345678',
      status: options.status ?? 'ACTIVE',
      emailVerifiedAt: options.emailVerifiedAt,
      userRoles: { create: [{ roleId: customerRole.id }] },
    },
  });
}
