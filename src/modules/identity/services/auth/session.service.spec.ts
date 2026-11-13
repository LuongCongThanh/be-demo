import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from '#src/modules/identity/services/auth/session.service.js';
import { PasswordService } from '#src/modules/identity/services/auth/password.service.js';
import { TokenService } from '#src/modules/identity/services/auth/token.service.js';

function createHarness() {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    refreshToken: {
      findUnique: vi.fn().mockResolvedValue(null),
      // count: 1 by default (the rotation claim succeeds); tests override to
      // 0 to simulate losing the race to a concurrent /auth/refresh call.
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const passwordService = {
    verify: vi.fn().mockResolvedValue(true),
  };

  const tokenService = {
    hashRawToken: vi.fn((rawCode: string) => `hash-of-${rawCode}`),
    createRefreshToken: vi.fn().mockResolvedValue('raw-refresh-token-abc'),
  };

  const jwtService = {
    sign: vi.fn().mockReturnValue('signed-access-token'),
  };

  const service = new SessionService(
    prisma as never,
    passwordService as unknown as PasswordService,
    tokenService as unknown as TokenService,
    jwtService as unknown as JwtService,
  );

  return { service, prisma, passwordService, tokenService, jwtService };
}

describe('SessionService.login', () => {
  // Shared valid user shape — tests override only the field that actually
  // matters for that case, keeping it visible at a glance (same pattern as
  // validRegisterDto()/validRecord() above).
  function validLoginUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'Nguyen Van A',
      passwordHash: 'hashed',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      sessionVersion: 0,
      role: 'CUSTOMER',
      ...overrides,
    };
  }

  it('throws UnauthorizedException when the email does not exist', async () => {
    const { service, prisma, passwordService } = createHarness();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login({ email: 'nobody@example.com', password: 'Abc@1234' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(passwordService.verify).not.toHaveBeenCalled();
  });

  it('throws the exact same error as "email does not exist" when the password is wrong', async () => {
    // Same error/message on purpose — this is what hides which case
    // happened (enumeration hiding), see 05-login.md.
    const { service, prisma, passwordService } = createHarness();
    prisma.user.findUnique.mockResolvedValue(validLoginUser());
    passwordService.verify.mockResolvedValue(false);

    await expect(service.login({ email: 'user@example.com', password: 'wrong' })).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
  });

  it('throws the generic credentials error, checked only after the password is confirmed correct, when the account is DISABLED', async () => {
    const { service, prisma, passwordService } = createHarness();
    prisma.user.findUnique.mockResolvedValue(validLoginUser({ status: 'DISABLED' }));

    await expect(service.login({ email: 'user@example.com', password: 'Abc@1234' })).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(passwordService.verify).toHaveBeenCalled();
  });

  it('throws when the account is ACTIVE but the email is not yet verified', async () => {
    const { service, prisma } = createHarness();
    prisma.user.findUnique.mockResolvedValue(validLoginUser({ emailVerifiedAt: null }));

    await expect(service.login({ email: 'user@example.com', password: 'Abc@1234' })).rejects.toThrow(
      new UnauthorizedException('Email is not verified'),
    );
  });

  it('returns an access token, a raw refresh token, and the user (without passwordHash) on success', async () => {
    const { service, prisma, tokenService, jwtService } = createHarness();
    prisma.user.findUnique.mockResolvedValue(validLoginUser());
    tokenService.createRefreshToken.mockResolvedValue('raw-refresh-token-xyz');
    jwtService.sign.mockReturnValue('signed-access-token-xyz');

    const result = await service.login({ email: 'user@example.com', password: 'Abc@1234' });

    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'CUSTOMER',
      sessionVersion: 0,
    });
    expect(tokenService.createRefreshToken).toHaveBeenCalledWith('user-1');
    // toEqual pins the exact shape below, so it also proves passwordHash is
    // absent — no separate not.toHaveProperty() assertion needed.
    expect(result).toEqual({
      accessToken: 'signed-access-token-xyz',
      rawRefreshToken: 'raw-refresh-token-xyz',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        fullName: 'Nguyen Van A',
        role: 'CUSTOMER',
        emailVerified: true,
      },
    });
  });
});

describe('SessionService.refreshToken', () => {
  // Shared valid record shape — tests override only the field that actually
  // matters for that case (same pattern as validLoginUser() above).
  function validRefreshTokenRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: 'token-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', email: 'user@example.com', sessionVersion: 0, role: 'CUSTOMER' },
      ...overrides,
    };
  }

  it('throws UnauthorizedException when no raw token is given', async () => {
    const { service } = createHarness();

    await expect(service.refreshToken(undefined)).rejects.toThrow(new UnauthorizedException('Missing refresh token'));
  });

  it('throws UnauthorizedException when the token hash matches no record', async () => {
    const { service, prisma, tokenService } = createHarness();
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    tokenService.hashRawToken.mockReturnValue('hash-of-unknown-token');

    await expect(service.refreshToken('unknown-token')).rejects.toThrow(
      new UnauthorizedException('Invalid refresh token'),
    );
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: 'hash-of-unknown-token' },
      include: { user: true },
    });
  });

  it('detects reuse of an already-revoked token: rejects and revokes every other session of that user', async () => {
    // A revokedAt != null means this exact token already went through
    // rotation once — someone else presenting it again means it leaked.
    const { service, prisma } = createHarness();
    prisma.refreshToken.findUnique.mockResolvedValue(validRefreshTokenRecord({ revokedAt: new Date() }));

    await expect(service.refreshToken('reused-token')).rejects.toThrow(
      new UnauthorizedException(
        'Refresh token has been revoked — all login sessions have been logged out for security reasons',
      ),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('throws UnauthorizedException when the token has expired', async () => {
    const { service, prisma } = createHarness();
    prisma.refreshToken.findUnique.mockResolvedValue(
      validRefreshTokenRecord({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(service.refreshToken('expired-token')).rejects.toThrow(
      new UnauthorizedException('Refresh token has expired'),
    );
  });

  it('treats losing the rotation-claim race as reuse: rejects and revokes every other session too', async () => {
    // Simulates 2 concurrent /auth/refresh calls with the same valid token:
    // both pass the revokedAt/expiresAt checks above before either commits,
    // but the conditional updateMany's WHERE re-checks revokedAt: null at
    // write time, so only one of them actually claims it — this one loses
    // (matches zero rows).
    const { service, prisma } = createHarness();
    prisma.refreshToken.findUnique.mockResolvedValue(validRefreshTokenRecord());
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.refreshToken('valid-token')).rejects.toThrow(
      new UnauthorizedException(
        'Refresh token has been revoked — all login sessions have been logged out for security reasons',
      ),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'token-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    // Losing the claim must still cascade to revoking every other session —
    // same consequence as genuine reuse detection above.
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rotates: revokes the presented token and returns a new access token + new raw refresh token', async () => {
    const { service, prisma, tokenService, jwtService } = createHarness();
    prisma.refreshToken.findUnique.mockResolvedValue(
      validRefreshTokenRecord({
        user: {
          id: 'user-1',
          email: 'user@example.com',
          sessionVersion: 0,
          role: 'CUSTOMER',
        },
      }),
    );
    tokenService.createRefreshToken.mockResolvedValue('new-raw-refresh-token');
    jwtService.sign.mockReturnValue('new-signed-access-token');

    const result = await service.refreshToken('valid-token');

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'token-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tokenService.createRefreshToken).toHaveBeenCalledWith('user-1');
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'CUSTOMER',
      sessionVersion: 0,
    });
    expect(result).toEqual({
      accessToken: 'new-signed-access-token',
      newRawRefreshToken: 'new-raw-refresh-token',
    });
  });
});

describe('SessionService.logout', () => {
  it('revokes the refresh token matching the given raw token, hashed and only if not already revoked', async () => {
    const { service, prisma, tokenService } = createHarness();
    tokenService.hashRawToken.mockReturnValue('hash-of-raw-refresh-token');

    await service.logout('raw-refresh-token');

    expect(tokenService.hashRawToken).toHaveBeenCalledWith('raw-refresh-token');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: 'hash-of-raw-refresh-token', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('does not throw when the token hash matches no record', async () => {
    const { service, prisma } = createHarness();
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.logout('unknown-token')).resolves.toBeUndefined();
  });
});

describe('SessionService.logoutAll', () => {
  it('revokes every not-yet-revoked refresh token belonging to the user', async () => {
    const { service, prisma } = createHarness();

    await service.logoutAll('user-1');

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
