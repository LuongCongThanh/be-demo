import { TokenService } from './token.service.js';

function createConfigMock() {
  return { get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue) };
}

function createPrismaMock() {
  const prisma = {
    emailVerificationToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
  };
  return prisma;
}

describe('TokenService', () => {
  it('deletes unverified tokens for the user before creating a new one', async () => {
    const prisma = createPrismaMock();
    const service = new TokenService(prisma as never, createConfigMock() as never);

    await service.createEmailVerificationToken('user-1');

    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', verifiedAt: null },
    });
    expect(prisma.emailVerificationToken.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.emailVerificationToken.create.mock.invocationCallOrder[0],
    );
  });

  it('creates a token record with a hash, not the raw code', async () => {
    const prisma = createPrismaMock();
    const service = new TokenService(prisma as never, createConfigMock() as never);

    const rawCode = await service.createEmailVerificationToken('user-1');

    expect(rawCode).toMatch(/^\d{6}$/); // 6-digit numeric code
    const createCall = prisma.emailVerificationToken.create.mock.calls[0][0];
    expect(createCall.data.userId).toBe('user-1');
    expect(createCall.data.tokenHash).not.toBe(rawCode);
    expect(createCall.data.tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    expect(createCall.data.expiresAt).toBeInstanceOf(Date);
  });

  it('returns a different raw code on every call', async () => {
    const prisma = createPrismaMock();
    const service = new TokenService(prisma as never, createConfigMock() as never);

    const first = await service.createEmailVerificationToken('user-1');
    const second = await service.createEmailVerificationToken('user-1');

    expect(first).not.toBe(second);
  });

  it('wraps delete+create in a transaction when no client is passed, so a failed create never leaves zero tokens', async () => {
    const prisma = createPrismaMock();
    prisma.emailVerificationToken.create.mockRejectedValue(new Error('DB write failed'));
    const service = new TokenService(prisma as never, createConfigMock() as never);

    await expect(service.createEmailVerificationToken('user-1')).rejects.toThrow('DB write failed');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not open a nested transaction when called with an existing tx client', async () => {
    const prisma = createPrismaMock();
    const service = new TokenService(prisma as never, createConfigMock() as never);
    const tx = {
      emailVerificationToken: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({}),
      },
    };

    await service.createEmailVerificationToken('user-1', tx as never);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.emailVerificationToken.create).toHaveBeenCalledTimes(1);
  });
});
