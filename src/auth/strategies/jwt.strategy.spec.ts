import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy.js';
import { PrismaService } from '../../prisma/prisma.service.js';

function createStrategy(userAuthorizationVersion: number | null) {
  const config = { getOrThrow: () => 'test-secret' } as unknown as ConfigService;
  const prisma = {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          userAuthorizationVersion === null ? null : { authorizationVersion: userAuthorizationVersion },
        ),
    },
  } as unknown as PrismaService;
  return new JwtStrategy(config, prisma);
}

describe('JwtStrategy', () => {
  it('accepts a payload whose authorizationVersion matches the current DB value', async () => {
    const strategy = createStrategy(2);
    const payload = { sub: 'user-1', email: 'user@example.com', roles: ['CUSTOMER'], authorizationVersion: 2 };

    await expect(strategy.validate(payload)).resolves.toBe(payload);
  });

  it('rejects a payload whose authorizationVersion is stale', async () => {
    const strategy = createStrategy(3);
    const payload = { sub: 'user-1', email: 'user@example.com', roles: ['CUSTOMER'], authorizationVersion: 2 };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a payload for a user that no longer exists', async () => {
    const strategy = createStrategy(null);
    const payload = { sub: 'deleted-user', email: 'gone@example.com', roles: ['CUSTOMER'], authorizationVersion: 0 };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
