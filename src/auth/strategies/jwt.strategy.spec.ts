import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '#src/auth/strategies/jwt.strategy.js';
import { PrismaService } from '#src/prisma/prisma.service.js';

function createStrategy(userSessionVersion: number | null) {
  const config = { getOrThrow: () => 'test-secret' } as unknown as ConfigService;
  const prisma = {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          userSessionVersion === null ? null : { sessionVersion: userSessionVersion, role: 'CUSTOMER' },
        ),
    },
  } as unknown as PrismaService;
  return new JwtStrategy(config, prisma);
}

describe('JwtStrategy', () => {
  it('accepts a payload whose sessionVersion matches the current DB value', async () => {
    const strategy = createStrategy(2);
    const payload = { sub: 'user-1', email: 'user@example.com', role: 'CUSTOMER' as const, sessionVersion: 2 };

    await expect(strategy.validate(payload)).resolves.toBe(payload);
  });

  it('rejects a payload whose sessionVersion is stale', async () => {
    const strategy = createStrategy(3);
    const payload = { sub: 'user-1', email: 'user@example.com', role: 'CUSTOMER' as const, sessionVersion: 2 };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a payload for a user that no longer exists', async () => {
    const strategy = createStrategy(null);
    const payload = { sub: 'deleted-user', email: 'gone@example.com', role: 'CUSTOMER' as const, sessionVersion: 0 };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
