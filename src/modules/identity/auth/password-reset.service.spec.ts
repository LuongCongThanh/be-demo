import { BadRequestException } from '@nestjs/common';
import { PasswordResetService } from '#src/modules/identity/auth/password-reset.service.js';
import { PasswordService } from '#src/modules/identity/auth/password.service.js';
import { TokenService } from '#src/modules/identity/auth/token.service.js';
import { MailService } from '#src/infrastructure/mail/mail.service.js';

function createHarness() {
  const tx = {
    user: {
      update: vi.fn().mockResolvedValue({}),
    },
    refreshToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    passwordResetToken: {
      findUnique: vi.fn().mockResolvedValue(null),
      // count: 1 by default (the claim succeeds); tests override to 0 to
      // simulate losing the race to a concurrent resetPassword() call.
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn(async (arg: unknown) => (arg as (tx: unknown) => unknown)(tx)),
  };

  const passwordService = {
    hash: vi.fn().mockResolvedValue('hashed-password'),
  };

  const tokenService = {
    hashRawToken: vi.fn((rawCode: string) => `hash-of-${rawCode}`),
    createPasswordResetToken: vi.fn().mockResolvedValue('raw-reset-token-abc'),
  };

  const mailService = {
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  };

  const service = new PasswordResetService(
    prisma as never,
    passwordService as unknown as PasswordService,
    tokenService as unknown as TokenService,
    mailService as unknown as MailService,
  );

  return { service, prisma, tx, passwordService, tokenService, mailService };
}

describe('PasswordResetService.forgotPassword', () => {
  const GENERIC_MESSAGE = 'If the email exists, a password reset link has been sent.';

  it('returns the generic message without creating a token when the email does not exist', async () => {
    const { service, prisma, tokenService, mailService } = createHarness();
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: 'nobody@example.com' });

    expect(result).toEqual({ message: GENERIC_MESSAGE });
    expect(tokenService.createPasswordResetToken).not.toHaveBeenCalled();
    expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('creates a reset token and emails it when the user exists', async () => {
    const { service, prisma, tokenService, mailService } = createHarness();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    tokenService.createPasswordResetToken.mockResolvedValue('fresh-reset-token');

    const result = await service.forgotPassword({ email: 'user@example.com' });

    expect(tokenService.createPasswordResetToken).toHaveBeenCalledWith('user-1');
    expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith('user@example.com', 'fresh-reset-token');
    expect(result).toEqual({ message: GENERIC_MESSAGE });
  });

  it('still returns the generic message even if sending the email fails', async () => {
    const { service, prisma, mailService } = createHarness();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    mailService.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP down'));

    const result = await service.forgotPassword({ email: 'user@example.com' });

    expect(result).toEqual({ message: GENERIC_MESSAGE });
  });
});

describe('PasswordResetService.resetPassword', () => {
  function validResetToken(overrides: Record<string, unknown> = {}) {
    return {
      id: 'reset-token-1',
      userId: 'user-1',
      tokenHash: 'hash-of-raw-reset-token',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    };
  }

  function validDto(overrides: Record<string, unknown> = {}) {
    return {
      token: 'raw-reset-token',
      password: 'NewAbc@1234',
      confirmPassword: 'NewAbc@1234',
      ...overrides,
    };
  }

  it('throws BadRequestException when the token hash matches no record', async () => {
    const { service, prisma } = createHarness();
    prisma.passwordResetToken.findUnique.mockResolvedValue(null);

    await expect(service.resetPassword(validDto())).rejects.toThrow(
      new BadRequestException('Invalid or expired token'),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the token was already used', async () => {
    const { service, prisma } = createHarness();
    prisma.passwordResetToken.findUnique.mockResolvedValue(validResetToken({ usedAt: new Date() }));

    await expect(service.resetPassword(validDto())).rejects.toThrow(
      new BadRequestException('Invalid or expired token'),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the token has expired', async () => {
    const { service, prisma } = createHarness();
    prisma.passwordResetToken.findUnique.mockResolvedValue(validResetToken({ expiresAt: new Date(Date.now() - 1000) }));

    await expect(service.resetPassword(validDto())).rejects.toThrow(
      new BadRequestException('Invalid or expired token'),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('claims the token, updates the password hash, and revokes every refresh token of the user', async () => {
    const { service, prisma, tx, passwordService } = createHarness();
    prisma.passwordResetToken.findUnique.mockResolvedValue(validResetToken());
    passwordService.hash.mockResolvedValue('new-hashed-password');
    tx.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.resetPassword(validDto());

    // Claim xảy ra TRƯỚC khi hash — hash không đáng tin cậy để assert thứ tự
    // qua mock call, nhưng quan trọng là claim dùng prisma (không phải tx):
    // xem comment trong resetPassword() về lý do claim trước, hash sau.
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'reset-token-1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(passwordService.hash).toHaveBeenCalledWith('NewAbc@1234');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'new-hashed-password' },
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result).toEqual({ message: 'Password has been reset. Please log in again.' });
  });

  it('rejects as already-used, without changing the password, when a concurrent request wins the race to claim the token first', async () => {
    const { service, prisma, passwordService, tx } = createHarness();
    prisma.passwordResetToken.findUnique.mockResolvedValue(validResetToken());
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.resetPassword(validDto())).rejects.toThrow(
      new BadRequestException('Invalid or expired token'),
    );
    // Thua race claim thì không hash lẫn không update gì cả — tránh phí CPU
    // hash một password sẽ bị vứt bỏ (đây chính là fix bug hiệu năng đã tìm ra).
    expect(passwordService.hash).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
