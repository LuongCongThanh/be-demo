import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { AuthService } from './auth.service.js';
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
      findUnique: vi.fn().mockResolvedValue(null),
    },
    // register() and verifyEmail() both pass a callback (`tx => ...`);
    // the callback receives the same `tx` mock, shared across both flows.
    $transaction: vi.fn(async (arg: unknown) => (arg as (tx: unknown) => unknown)(tx)),
  };

  const passwordService = {
    hash: vi.fn().mockResolvedValue('hashed-password'),
  };

  const tokenService = {
    createEmailVerificationToken: vi.fn().mockResolvedValue('raw-token-abc'),
    hashRawToken: vi.fn((rawToken: string) => `hash-of-${rawToken}`),
  };

  const mailService = {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  };

  const service = new AuthService(
    prisma as never,
    passwordService as unknown as PasswordService,
    tokenService as unknown as TokenService,
    mailService as unknown as MailService,
  );

  return { service, prisma, tx, passwordService, tokenService, mailService };
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
    expect(mailService.sendVerificationEmail).toHaveBeenCalledWith('new@example.com', 'raw-token-abc');
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
  function validRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: 'token-1',
      userId: 'user-1',
      tokenHash: 'hash-of-raw-token',
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 60_000), // 1 minute in the future
      ...overrides,
    };
  }

  it('hashes the raw token before looking it up, never queries by raw token', async () => {
    const { service, prisma, tokenService } = createHarness();
    prisma.emailVerificationToken.findUnique.mockResolvedValue(validRecord());

    await service.verifyEmail({ token: 'raw-token' });

    expect(tokenService.hashRawToken).toHaveBeenCalledWith('raw-token');
    expect(prisma.emailVerificationToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: 'hash-of-raw-token' },
    });
  });

  it('throws NotFoundException when the token does not exist', async () => {
    const { service, prisma } = createHarness();
    prisma.emailVerificationToken.findUnique.mockResolvedValue(null);

    await expect(service.verifyEmail({ token: 'bogus' })).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException on replay: a token already verified must be rejected, not treated as idempotent', async () => {
    const { service, prisma } = createHarness();
    prisma.emailVerificationToken.findUnique.mockResolvedValue(validRecord({ verifiedAt: new Date() }));

    await expect(service.verifyEmail({ token: 'raw-token' })).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the token has expired', async () => {
    const { service, prisma } = createHarness();
    prisma.emailVerificationToken.findUnique.mockResolvedValue(validRecord({ expiresAt: new Date(Date.now() - 1000) }));

    await expect(service.verifyEmail({ token: 'raw-token' })).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('marks both the user and the token as verified in one transaction, then returns a success message', async () => {
    const { service, prisma, tx } = createHarness();
    prisma.emailVerificationToken.findUnique.mockResolvedValue(validRecord());

    const result = await service.verifyEmail({ token: 'raw-token' });

    // The claim (conditional updateMany) must run before, and its WHERE
    // clause must re-check verifiedAt: null — that guard is what closes
    // the race window between findUnique() and the transaction.
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

  it('rejects as already-used, without touching User, when a concurrent request wins the race to claim the token first', async () => {
    // Simulates the TOCTOU window between findUnique() (above) and the
    // transaction: another request's conditional update already flipped
    // verifiedAt, so this request's claim matches zero rows.
    const { service, prisma, tx } = createHarness();
    prisma.emailVerificationToken.findUnique.mockResolvedValue(validRecord());
    tx.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.verifyEmail({ token: 'raw-token' })).rejects.toThrow(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
