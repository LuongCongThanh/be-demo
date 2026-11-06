import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '#src/generated/prisma/client.js';
import { InternalAccountService } from '#src/modules/identity/services/internal-account/internal-account.service.js';
import type { PrismaService } from '#src/prisma/prisma.service.js';
import type { PasswordService } from '#src/modules/identity/services/auth/password.service.js';
import type { AuditLogService } from '#src/audit/audit-log.service.js';

function setup() {
  const tx = { user: { create: vi.fn() } };
  const prisma = {
    user: { findUnique: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const passwords = { hash: vi.fn().mockResolvedValue('hashed') };
  const audit = { record: vi.fn() };
  const service = new InternalAccountService(
    prisma as unknown as PrismaService,
    passwords as unknown as PasswordService,
    audit as unknown as AuditLogService,
  );
  return { service, prisma, tx, passwords, audit };
}

const input = { email: 'a@x.local', name: 'A', password: 'Abc@1234', role: 'ADMIN' as const, actorUserId: null };

describe('InternalAccountService.create', () => {
  it('creates a verified ACTIVE account with a hashed password and audits admin.create', async () => {
    const h = setup();
    h.prisma.user.findUnique.mockResolvedValue(null);
    h.tx.user.create.mockResolvedValue({ id: 'u1', email: 'a@x.local', fullName: 'A', role: 'ADMIN' });

    await h.service.create(input);

    const data = h.tx.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ passwordHash: 'hashed', role: 'ADMIN', status: 'ACTIVE' });
    expect(data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(h.audit.record).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({ action: 'admin.create', actorUserId: null }),
    );
  });

  it('audits staff.create for STAFF accounts', async () => {
    const h = setup();
    h.prisma.user.findUnique.mockResolvedValue(null);
    h.tx.user.create.mockResolvedValue({ id: 'u1', email: 'a@x.local', fullName: 'A', role: 'STAFF' });

    await h.service.create({ ...input, role: 'STAFF', actorUserId: 'admin-1' });

    expect(h.audit.record).toHaveBeenCalledWith(h.tx, expect.objectContaining({ action: 'staff.create' }));
  });

  it('rejects an existing email with 409 before hashing', async () => {
    const h = setup();
    h.prisma.user.findUnique.mockResolvedValue({ id: 'taken' });

    await expect(h.service.create(input)).rejects.toThrow(ConflictException);
    expect(h.passwords.hash).not.toHaveBeenCalled();
  });

  it('maps a racing P2002 on email to 409', async () => {
    const h = setup();
    h.prisma.user.findUnique.mockResolvedValue(null);
    h.tx.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
        meta: { target: ['email'] },
      }),
    );

    await expect(h.service.create(input)).rejects.toThrow(ConflictException);
  });
});
