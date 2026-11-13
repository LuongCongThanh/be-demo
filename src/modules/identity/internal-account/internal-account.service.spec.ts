import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '#src/generated/prisma/client.js';
import { InternalAccountService } from '#src/modules/identity/internal-account/internal-account.service.js';
import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import type { PasswordService } from '#src/modules/identity/auth/password.service.js';
import type { AccessService } from '#src/modules/identity/access/access.service.js';
import type { AuditLogService } from '#src/infrastructure/audit/audit-log.service.js';

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
    { assertNotAdminHolder: vi.fn() } as unknown as AccessService,
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

const staff = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  email: 's@x.local',
  fullName: 'Nhan Vien',
  role: 'STAFF',
  status: 'ACTIVE',
  passwordHash: 'hash',
  createdAt: new Date(0),
  updatedAt: new Date(0),
  userRoles: [{ role: { id: 'r-staff', name: 'Staff', isSystem: true } }],
  ...over,
});

function setupStaff() {
  const tx = {
    $queryRaw: vi.fn(),
    user: { findFirst: vi.fn(), update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn((arg: unknown) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg as unknown[]))),
    user: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  };
  const audit = { record: vi.fn() };
  const passwords = { hash: vi.fn() };
  const service = new InternalAccountService(
    prisma as unknown as PrismaService,
    passwords as unknown as PasswordService,
    audit as unknown as AuditLogService,
    { assertNotAdminHolder: vi.fn() } as unknown as AccessService,
  );
  const accounts = { create: vi.spyOn(service, 'create') as unknown as ReturnType<typeof vi.fn> };
  return { service, prisma, tx, audit, accounts };
}

describe('InternalAccountService staff management', () => {
  let h: ReturnType<typeof setupStaff>;
  beforeEach(() => {
    h = setupStaff();
  });

  it('create delegates to InternalAccountService with role STAFF and maps to the allow-list DTO', async () => {
    h.accounts.create.mockResolvedValue(staff());
    h.prisma.user.findFirst.mockResolvedValue(staff());
    const result = await h.service.createStaff(
      { email: 's@x.local', name: 'Nhan Vien', password: 'Abc@1234' },
      'admin-1',
    );

    expect(h.accounts.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'STAFF', actorUserId: 'admin-1' }));
    expect(result).toEqual({
      id: 's1',
      email: 's@x.local',
      name: 'Nhan Vien',
      status: 'ACTIVE',
      roles: [{ id: 'r-staff', name: 'Staff', isSystem: true }],
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('findAll only lists STAFF and returns the pagination envelope', async () => {
    h.prisma.user.findMany.mockResolvedValue([staff()]);
    h.prisma.user.count.mockResolvedValue(21);

    const result = await h.service.findAllStaff({ page: 2, limit: 10 });

    expect(h.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'STAFF' }, skip: 10, take: 10 }),
    );
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
  });

  describe('rename', () => {
    it('updates the name and records staff.rename with before/after', async () => {
      h.tx.user.findFirst.mockResolvedValue(staff());
      h.tx.user.update.mockResolvedValue(staff({ fullName: 'Ten Moi' }));

      await h.service.renameStaff('s1', { name: 'Ten Moi' }, 'admin-1');

      expect(h.audit.record).toHaveBeenCalledWith(
        h.tx,
        expect.objectContaining({
          action: 'staff.rename',
          before: { name: 'Nhan Vien' },
          after: { name: 'Ten Moi' },
        }),
      );
    });

    it('is a no-op without audit when the name is unchanged', async () => {
      h.tx.user.findFirst.mockResolvedValue(staff());

      await h.service.renameStaff('s1', { name: 'Nhan Vien' }, 'admin-1');

      expect(h.tx.user.update).not.toHaveBeenCalled();
      expect(h.audit.record).not.toHaveBeenCalled();
    });

    it('throws 404 when the target is not a STAFF account', async () => {
      h.tx.user.findFirst.mockResolvedValue(null);
      await expect(h.service.renameStaff('admin-1', { name: 'X' }, 'admin-1')).rejects.toThrow(NotFoundException);
      expect(h.tx.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'admin-1', role: 'STAFF' },
        include: expect.any(Object),
      });
    });
  });

  describe('disable / enable', () => {
    it('disabling bumps sessionVersion, revokes refresh tokens and audits once', async () => {
      h.tx.user.findFirst.mockResolvedValue(staff());
      h.tx.user.update.mockResolvedValue(staff({ status: 'DISABLED' }));

      const result = await h.service.disableStaff('s1', 'admin-1');

      expect(result.status).toBe('DISABLED');
      expect(h.tx.user.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'DISABLED', sessionVersion: { increment: 1 } },
        include: expect.any(Object),
      });
      expect(h.tx.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 's1', revokedAt: null } }),
      );
      expect(h.audit.record).toHaveBeenCalledWith(h.tx, expect.objectContaining({ action: 'staff.disable' }));
    });

    it('disabling an already DISABLED staff changes nothing', async () => {
      h.tx.user.findFirst.mockResolvedValue(staff({ status: 'DISABLED' }));

      await h.service.disableStaff('s1', 'admin-1');

      expect(h.tx.user.update).not.toHaveBeenCalled();
      expect(h.audit.record).not.toHaveBeenCalled();
    });

    it('enabling restores ACTIVE without touching sessions', async () => {
      h.tx.user.findFirst.mockResolvedValue(staff({ status: 'DISABLED' }));
      h.tx.user.update.mockResolvedValue(staff());

      await h.service.enableStaff('s1', 'admin-1');

      expect(h.tx.user.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'ACTIVE' },
        include: expect.any(Object),
      });
      expect(h.tx.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(h.audit.record).toHaveBeenCalledWith(h.tx, expect.objectContaining({ action: 'staff.enable' }));
    });
  });
});
