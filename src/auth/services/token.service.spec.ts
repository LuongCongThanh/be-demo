import { TokenService } from './token.service.js';

function createPrismaMock() {
  return {
    emailVerificationToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

describe('TokenService', () => {
  it('deletes unverified tokens for the user before creating a new one', async () => {
    const prisma = createPrismaMock();
    const service = new TokenService(prisma as never);

    await service.createEmailVerificationToken('user-1');

    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', verifiedAt: null },
    });
    expect(
      prisma.emailVerificationToken.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      prisma.emailVerificationToken.create.mock.invocationCallOrder[0],
    );
  });

  it('creates a token record with a hash, not the raw token', async () => {
    const prisma = createPrismaMock();
    const service = new TokenService(prisma as never);

    const rawToken = await service.createEmailVerificationToken('user-1');

    expect(rawToken).toMatch(/^[0-9a-f]{64}$/); // 32 random bytes as hex
    const createCall = prisma.emailVerificationToken.create.mock.calls[0][0];
    expect(createCall.data.userId).toBe('user-1');
    expect(createCall.data.tokenHash).not.toBe(rawToken);
    expect(createCall.data.tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    expect(createCall.data.expiresAt).toBeInstanceOf(Date);
  });

  it('returns a different raw token on every call', async () => {
    const prisma = createPrismaMock();
    const service = new TokenService(prisma as never);

    const first = await service.createEmailVerificationToken('user-1');
    const second = await service.createEmailVerificationToken('user-1');

    expect(first).not.toBe(second);
  });
});
