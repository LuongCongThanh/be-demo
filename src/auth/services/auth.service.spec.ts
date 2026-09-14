import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { MailService } from '../../mail/mail.service.js';

function createHarness() {
  const customerRole = { id: 'role-customer', name: 'CUSTOMER' };
  const createdUser = { id: 'user-1', email: 'new@example.com' };

  const tx = {
    role: { findUniqueOrThrow: vi.fn().mockResolvedValue(customerRole) },
    user: { create: vi.fn().mockResolvedValue(createdUser) },
  };

  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback(tx),
    ),
  };

  const passwordService = {
    hash: vi.fn().mockResolvedValue('hashed-password'),
  };

  const tokenService = {
    createEmailVerificationToken: vi.fn().mockResolvedValue('raw-token-abc'),
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
  it('throws ConflictException when the email is already taken', async () => {
    const { service, prisma, passwordService } = createHarness();
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.register({ email: 'taken@example.com', password: 'Abc@1234' }),
    ).rejects.toThrow(ConflictException);

    expect(passwordService.hash).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates the user with a hashed password and the CUSTOMER role', async () => {
    const { service, tx } = createHarness();

    const result = await service.register({
      email: 'new@example.com',
      password: 'Abc@1234',
    });

    expect(tx.role.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { name: 'CUSTOMER' },
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'new@example.com',
        passwordHash: 'hashed-password',
        status: 'ACTIVE',
        userRoles: { create: [{ roleId: 'role-customer' }] },
      }),
    });
    expect(result).toEqual({ id: 'user-1', email: 'new@example.com' });
  });

  it('creates an email verification token inside the same transaction', async () => {
    const { service, tokenService, tx } = createHarness();

    await service.register({
      email: 'new@example.com',
      password: 'Abc@1234',
    });

    expect(tokenService.createEmailVerificationToken).toHaveBeenCalledWith(
      'user-1',
      tx,
    );
  });

  it('sends the verification email after the transaction commits', async () => {
    const { service, mailService, prisma } = createHarness();
    const callOrder: string[] = [];
    prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        const result = await callback({
          role: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'r' }) },
          user: {
            create: vi
              .fn()
              .mockResolvedValue({ id: 'user-1', email: 'new@example.com' }),
          },
        });
        callOrder.push('transaction-committed');
        return result;
      },
    );
    mailService.sendVerificationEmail.mockImplementation(async () => {
      callOrder.push('mail-sent');
    });

    await service.register({
      email: 'new@example.com',
      password: 'Abc@1234',
    });

    expect(callOrder).toEqual(['transaction-committed', 'mail-sent']);
    expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
      'new@example.com',
      'raw-token-abc',
    );
  });

  it('still creates the user even if sending the verification email fails', async () => {
    const { service, mailService, tx } = createHarness();
    mailService.sendVerificationEmail.mockRejectedValue(new Error('SMTP down'));

    const result = await service.register({
      email: 'new@example.com',
      password: 'Abc@1234',
    });

    expect(result).toEqual({ id: 'user-1', email: 'new@example.com' });
    expect(tx.user.create).toHaveBeenCalledTimes(1);
  });

  it('never returns the password hash', async () => {
    const { service } = createHarness();

    const result = await service.register({
      email: 'new@example.com',
      password: 'Abc@1234',
    });

    expect(result).not.toHaveProperty('passwordHash');
  });
});
