import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../generated/prisma/client.js';
import { AuthService, GENERIC_RESEND_MESSAGE, MAX_VERIFY_ATTEMPTS } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { MailService } from '../../mail/mail.service.js';

function createHarness() {
  const customerRole = { id: 'role-customer', name: 'CUSTOMER' };
  const createdUser = { id: 'user-1', email: 'new@example.com' };

  const tx = {
    role: { findUniqueOrThrow: vi.fn().mockResolvedValue(customerRole) },
    user: {
      create: vi.fn().mockResolvedValue(createdUser),
      update: vi.fn().mockResolvedValue({}),
    },
    emailVerificationToken: {
      // count: 1 by default (the claim succeeds); tests override to 0 to
      // simulate losing the race to a concurrent verifyEmail() call.
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    emailVerificationToken: {
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    refreshToken: {
      findUnique: vi.fn().mockResolvedValue(null),
      // count: 1 by default (the rotation claim succeeds); tests override to
      // 0 to simulate losing the race to a concurrent /auth/refresh call.
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    // register() and verifyEmail() both pass a callback (`tx => ...`);
    // the callback receives the same `tx` mock, shared across both flows.
    $transaction: vi.fn(async (arg: unknown) => (arg as (tx: unknown) => unknown)(tx)),
  };

  const passwordService = {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    verify: vi.fn().mockResolvedValue(true),
  };

  const tokenService = {
    createEmailVerificationToken: vi.fn().mockResolvedValue('raw-code-abc'),
    hashRawToken: vi.fn((rawCode: string) => `hash-of-${rawCode}`),
    createRefreshToken: vi.fn().mockResolvedValue('raw-refresh-token-abc'),
  };

  const mailService = {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  };

  const jwtService = {
    sign: vi.fn().mockReturnValue('signed-access-token'),
  };

  const service = new AuthService(
    prisma as never,
    passwordService as unknown as PasswordService,
    tokenService as unknown as TokenService,
    mailService as unknown as MailService,
    jwtService as unknown as JwtService,
  );

  return { service, prisma, tx, passwordService, tokenService, mailService, jwtService };
}

describe('AuthService.register', () => {
  // fullName/phone are required on RegisterDto but not what any of these
  // tests are about — a shared valid payload keeps each test's own
  // overrides (the part that actually matters) visible at a glance.
  function validRegisterDto(overrides: Record<string, unknown> = {}) {
    return {
      email: 'new@example.com',
      password: 'Abc@1234',
      fullName: 'Nguyen Van A',
      phone: '0912345678',
      ...overrides,
    };
  }

  it('throws ConflictException when the email is already taken', async () => {
    const { service, prisma, passwordService } = createHarness();
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(service.register(validRegisterDto({ email: 'taken@example.com' }))).rejects.toThrow(ConflictException);

    expect(passwordService.hash).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the DB unique constraint rejects a concurrent duplicate registration', async () => {
    // The findUnique pre-check races with another request for the same
    // email: both pass the check, then the transaction's tx.user.create
    // hits the DB's unique constraint (Prisma P2002) on `email`.
    const { service, prisma } = createHarness();
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      }),
    );

    await expect(service.register(validRegisterDto({ email: 'race@example.com' }))).rejects.toThrow(ConflictException);
  });

  it('rethrows a P2002 that is not on the `email` constraint unchanged', async () => {
    // Same transaction also creates an EmailVerificationToken with its own
    // unique `tokenHash`. A P2002 on that column must not be misreported
    // as "email already in use".
    const { service, prisma } = createHarness();
    const tokenHashCollision = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['token_hash'] },
    });
    prisma.$transaction.mockRejectedValue(tokenHashCollision);

    await expect(service.register(validRegisterDto())).rejects.toBe(tokenHashCollision);
  });

  it('rethrows other transaction errors unchanged', async () => {
    const { service, prisma } = createHarness();
    prisma.$transaction.mockRejectedValue(new Error('DB connection lost'));

    await expect(service.register(validRegisterDto())).rejects.toThrow('DB connection lost');
  });

  it('creates the user with a hashed password and the CUSTOMER role', async () => {
    const { service, tx } = createHarness();

    const result = await service.register(validRegisterDto());

    expect(tx.role.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { name: 'CUSTOMER' },
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'new@example.com',
        passwordHash: 'hashed-password',
        fullName: 'Nguyen Van A',
        phone: '0912345678',
        status: 'ACTIVE',
        userRoles: { create: [{ roleId: 'role-customer' }] },
      }),
    });
    expect(result).toEqual({ id: 'user-1', email: 'new@example.com' });
  });

  it('creates an email verification token inside the same transaction', async () => {
    const { service, tokenService, tx } = createHarness();

    await service.register(validRegisterDto());

    expect(tokenService.createEmailVerificationToken).toHaveBeenCalledWith('user-1', tx);
  });

  it('sends the verification email after the transaction commits', async () => {
    const { service, mailService, prisma } = createHarness();
    const callOrder: string[] = [];
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      const callback = arg as (tx: unknown) => unknown;
      const result = await callback({
        role: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'r' }) },
        user: {
          create: vi.fn().mockResolvedValue({ id: 'user-1', email: 'new@example.com' }),
        },
      });
      callOrder.push('transaction-committed');
      return result;
    });
    mailService.sendVerificationEmail.mockImplementation(async () => {
      callOrder.push('mail-sent');
    });

    await service.register(validRegisterDto());

    expect(callOrder).toEqual(['transaction-committed', 'mail-sent']);
    expect(mailService.sendVerificationEmail).toHaveBeenCalledWith('new@example.com', 'raw-code-abc');
  });

  it('still creates the user even if sending the verification email fails', async () => {
    const { service, mailService, tx } = createHarness();
    mailService.sendVerificationEmail.mockRejectedValue(new Error('SMTP down'));

    const result = await service.register(validRegisterDto());

    expect(result).toEqual({ id: 'user-1', email: 'new@example.com' });
    expect(tx.user.create).toHaveBeenCalledTimes(1);
  });

  it('never returns the password hash', async () => {
    const { service } = createHarness();

    const result = await service.register(validRegisterDto());

    expect(result).not.toHaveProperty('passwordHash');
  });
});

describe('AuthService.verifyEmail', () => {
  const existingUser = { id: 'user-1', email: 'user@example.com' };

  function validRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: 'token-1',
      userId: 'user-1',
      tokenHash: 'hash-of-raw-code',
      attempts: 0,
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 60_000), // 1 minute in the future
      ...overrides,
    };
  }

  it('looks up the pending code by userId, then hashes the given code to compare locally', async () => {
    const { service, prisma, tokenService } = createHarness();
    prisma.user.findUnique.mockResolvedValue(existingUser);
    prisma.emailVerificationToken.findFirst.mockResolvedValue(validRecord());

    await service.verifyEmail({ email: 'user@example.com', code: 'raw-code' });

    expect(prisma.emailVerificationToken.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(tokenService.hashRawToken).toHaveBeenCalledWith('raw-code');
  });

  it('throws NotFoundException when the email does not exist', async () => {
    const { service, prisma } = createHarness();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.verifyEmail({ email: 'nobody@example.com', code: '123456' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the user has no pending verification code', async () => {
    const { service, prisma } = createHarness();
    prisma.user.findUnique.mockResolvedValue(existingUser);
    prisma.emailVerificationToken.findFirst.mockResolvedValue(null);

    await expect(service.verifyEmail({ email: 'user@example.com', code: '123456' })).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException on replay: a code already verified must be rejected, not treated as idempotent', async () => {
    const { service, prisma } = createHarness();
    prisma.user.findUnique.mockResolvedValue(existingUser);
    prisma.emailVerificationToken.findFirst.mockResolvedValue(validRecord({ verifiedAt: new Date() }));

    await expect(service.verifyEmail({ email: 'user@example.com', code: 'raw-code' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the code has expired', async () => {
    const { service, prisma } = createHarness();
    prisma.user.findUnique.mockResolvedValue(existingUser);
    prisma.emailVerificationToken.findFirst.mockResolvedValue(validRecord({ expiresAt: new Date(Date.now() - 1000) }));

    await expect(service.verifyEmail({ email: 'user@example.com', code: 'raw-code' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException once attempts already reached the max, without comparing the code', async () => {
    const { service, prisma, tokenService } = createHarness();
    prisma.user.findUnique.mockResolvedValue(existingUser);
    prisma.emailVerificationToken.findFirst.mockResolvedValue(validRecord({ attempts: MAX_VERIFY_ATTEMPTS }));

    await expect(service.verifyEmail({ email: 'user@example.com', code: 'raw-code' })).rejects.toThrow(
      BadRequestException,
    );
    expect(tokenService.hashRawToken).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('increments attempts and throws NotFoundException when the code is wrong, without touching the transaction', async () => {
    const { service, prisma } = createHarness();
    prisma.user.findUnique.mockResolvedValue(existingUser);
    prisma.emailVerificationToken.findFirst.mockResolvedValue(validRecord());

    await expect(service.verifyEmail({ email: 'user@example.com', code: 'wrong-code' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'token-1', attempts: { lt: MAX_VERIFY_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('still rejects as invalid when a concurrent guess already pushed attempts to the cap (updateMany matches zero rows)', async () => {
    // Simulates 2 wrong guesses arriving together when attempts is one below
    // the cap: both read attempts < MAX before either commits, but the
    // conditional updateMany's WHERE re-checks attempts < MAX at write time,
    // so only one of them actually increments — this one matches zero rows.
    const { service, prisma } = createHarness();
    prisma.user.findUnique.mockResolvedValue(existingUser);
    prisma.emailVerificationToken.findFirst.mockResolvedValue(validRecord({ attempts: MAX_VERIFY_ATTEMPTS - 1 }));
    prisma.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.verifyEmail({ email: 'user@example.com', code: 'wrong-code' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('marks both the user and the token as verified in one transaction, then returns a success message', async () => {
    const { service, prisma, tx } = createHarness();
    prisma.user.findUnique.mockResolvedValue(existingUser);
    prisma.emailVerificationToken.findFirst.mockResolvedValue(validRecord());

    const result = await service.verifyEmail({ email: 'user@example.com', code: 'raw-code' });

    // The claim (conditional updateMany) must run before, and its WHERE
    // clause must re-check verifiedAt: null — that guard is what closes
    // the race window between findFirst() and the transaction.
    expect(tx.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'token-1', verifiedAt: null },
      data: { verifiedAt: expect.any(Date) },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { emailVerifiedAt: expect.any(Date) },
    });
    expect(result).toEqual({ message: 'Email verified successfully' });
  });

  it('rejects as already-used, without touching User, when a concurrent request wins the race to claim the code first', async () => {
    // Simulates the TOCTOU window between findFirst() (above) and the
    // transaction: another request's conditional update already flipped
    // verifiedAt, so this request's claim matches zero rows.
    const { service, prisma, tx } = createHarness();
    prisma.user.findUnique.mockResolvedValue(existingUser);
    prisma.emailVerificationToken.findFirst.mockResolvedValue(validRecord());
    tx.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.verifyEmail({ email: 'user@example.com', code: 'raw-code' })).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('AuthService.resendVerification', () => {
  const existingUser = { id: 'user-1', email: 'user@example.com', emailVerifiedAt: null };

  it('returns the generic message without creating a token when the email does not exist', async () => {
    const { service, prisma, tokenService, mailService } = createHarness();
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.resendVerification({ email: 'nobody@example.com' });

    expect(result).toEqual({ message: GENERIC_RESEND_MESSAGE });
    expect(tokenService.createEmailVerificationToken).not.toHaveBeenCalled();
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('returns the same generic message without creating a token when the email is already verified', async () => {
    // Same response as "email does not exist" on purpose — this is what
    // hides enumeration; a test change here should be a deliberate one.
    const { service, prisma, tokenService, mailService } = createHarness();
    prisma.user.findUnique.mockResolvedValue({ ...existingUser, emailVerifiedAt: new Date() });

    const result = await service.resendVerification({ email: 'user@example.com' });

    expect(result).toEqual({ message: GENERIC_RESEND_MESSAGE });
    expect(tokenService.createEmailVerificationToken).not.toHaveBeenCalled();
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('creates a new token and emails it when the user exists and is not yet verified', async () => {
    const { service, prisma, tokenService, mailService } = createHarness();
    prisma.user.findUnique.mockResolvedValue(existingUser);
    tokenService.createEmailVerificationToken.mockResolvedValue('fresh-code');

    const result = await service.resendVerification({ email: 'user@example.com' });

    expect(tokenService.createEmailVerificationToken).toHaveBeenCalledWith('user-1');
    expect(mailService.sendVerificationEmail).toHaveBeenCalledWith('user@example.com', 'fresh-code');
    expect(result).toEqual({ message: GENERIC_RESEND_MESSAGE });
  });

  it('still returns the generic message even if sending the email fails', async () => {
    const { service, prisma, mailService } = createHarness();
    prisma.user.findUnique.mockResolvedValue(existingUser);
    mailService.sendVerificationEmail.mockRejectedValue(new Error('SMTP down'));

    const result = await service.resendVerification({ email: 'user@example.com' });

    expect(result).toEqual({ message: GENERIC_RESEND_MESSAGE });
  });
});

describe('AuthService.login', () => {
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
      userRoles: [{ role: { name: 'CUSTOMER' } }],
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

  it('throws a distinct error, checked only after the password is confirmed correct, when the account is BLOCKED', async () => {
    const { service, prisma, passwordService } = createHarness();
    prisma.user.findUnique.mockResolvedValue(validLoginUser({ status: 'BLOCKED' }));

    await expect(service.login({ email: 'user@example.com', password: 'Abc@1234' })).rejects.toThrow(
      new UnauthorizedException('Account is locked'),
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

    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'user-1', email: 'user@example.com', roles: ['CUSTOMER'] });
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
        roles: ['CUSTOMER'],
        emailVerified: true,
      },
    });
  });
});

describe('AuthService.refreshToken', () => {
  // Shared valid record shape — tests override only the field that actually
  // matters for that case (same pattern as validLoginUser() above).
  function validRefreshTokenRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: 'token-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', email: 'user@example.com', userRoles: [] },
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
      include: { user: { include: { userRoles: { include: { role: true } } } } },
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
        user: { id: 'user-1', email: 'user@example.com', userRoles: [{ role: { name: 'CUSTOMER' } }] },
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
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'user-1', email: 'user@example.com', roles: ['CUSTOMER'] });
    expect(result).toEqual({
      accessToken: 'new-signed-access-token',
      newRawRefreshToken: 'new-raw-refresh-token',
    });
  });
});
