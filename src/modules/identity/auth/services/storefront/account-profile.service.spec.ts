import { AccountProfileService } from '#src/modules/identity/auth/services/storefront/account-profile.service.js';

function createHarness() {
  const prisma = {
    user: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    customerAddress: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  const service = new AccountProfileService(prisma as never);

  return { service, prisma };
}

describe('AccountProfileService.getMe', () => {
  it('maps the user to the allow-list DTO, without passwordHash', async () => {
    const { service, prisma } = createHarness();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'Nguyen Van A',
      passwordHash: 'hashed',
      emailVerifiedAt: new Date(),
      role: 'CUSTOMER',
    });

    const result = await service.getMe('user-1', { roles: [], permissions: [] });

    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
    expect(result).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'Nguyen Van A',
      role: 'CUSTOMER',
      emailVerified: true,
      roles: [],
      permissions: [],
    });
  });

  describe('AccountProfileService.addresses', () => {
    it('creates a default address and clears existing defaults in one transaction', async () => {
      const { service, prisma } = createHarness();
      const tx = {
        customerAddress: {
          updateMany: vi.fn(),
          create: vi.fn().mockResolvedValue({ id: 'address-1', isDefault: true }),
        },
      };
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx));

      const result = await service.createAddress('user-1', {
        fullName: 'Nguyen Van A',
        phone: '0912345678',
        provinceCode: '79',
        provinceName: 'TP Ho Chi Minh',
        wardCode: '767',
        wardName: 'Phuong X',
        addressLine: '12 Nguyen Trai',
        isDefault: true,
      });

      expect(tx.customerAddress.updateMany).toHaveBeenCalled();
      expect(tx.customerAddress.create).toHaveBeenCalled();
      expect(result).toMatchObject({ id: 'address-1', isDefault: true });
    });
  });
});
