import { AccountProfileService } from '#src/modules/identity/auth/account-profile.service.js';

function createHarness() {
  const prisma = {
    user: {
      findUniqueOrThrow: vi.fn(),
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

    const result = await service.getMe('user-1');

    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
    expect(result).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'Nguyen Van A',
      role: 'CUSTOMER',
      emailVerified: true,
    });
  });
});
