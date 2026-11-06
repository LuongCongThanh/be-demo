import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffService } from '#src/modules/identity/services/internal-account/staff.service.js';
import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import type { AuditLogService } from '#src/infrastructure/audit/audit-log.service.js';
import type { InternalAccountService } from '#src/modules/identity/services/internal-account/internal-account.service.js';

const staff = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  email: 's@x.local',
  fullName: 'Nhan Vien',
  role: 'STAFF',
  status: 'ACTIVE',
  passwordHash: 'hash',
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...over,
});

function setup() {
  const tx = {
    $queryRaw: vi.fn(),
    user: { findFirst: vi.fn(), update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn((arg: unknown) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg as unknown[]))),
    user: { findMany: vi.fn(), count: vi.fn() },
  };
  const audit = { record: vi.fn() };
  const accounts = { create: vi.fn() };
  const service = new StaffService(
    prisma as unknown as PrismaService,
    accounts as unknown as InternalAccountService,
    audit as unknown as AuditLogService,
  );
  return { service, prisma, tx, audit, accounts };
}

describe('StaffService', () => {
  let h: ReturnType<typeof setup>;
  beforeEach(() => {
    h = setup();
  });

  it('create delegates to InternalAccountService with role STAFF and maps to the allow-list DTO', async () => {
    h.accounts.create.mockResolvedValue(staff());
    const result = await h.service.create({ email: 's@x.local', name: 'Nhan Vien', password: 'Abc@1234' }, 'admin-1');

    expect(h.accounts.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'STAFF', actorUserId: 'admin-1' }));
    expect(result).toEqual({
      id: 's1',
      email: 's@x.local',
      name: 'Nhan Vien',
      status: 'ACTIVE',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('findAll only lists STAFF and returns the pagination envelope', async () => {
    h.prisma.user.findMany.mockResolvedValue([staff()]);
    h.prisma.user.count.mockResolvedValue(21);

    const result = await h.service.findAll({ page: 2, limit: 10 });

    expect(h.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'STAFF' }, skip: 10, take: 10 }),
    );
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
  });

  describe('rename', () => {
    it('updates the name and records staff.rename with before/after', async () => {
      h.tx.user.findFirst.mockResolvedValue(staff());
      h.tx.user.update.mockResolvedValue(staff({ fullName: 'Ten Moi' }));

      await h.service.rename('s1', { name: 'Ten Moi' }, 'admin-1');

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

      await h.service.rename('s1', { name: 'Nhan Vien' }, 'admin-1');

      expect(h.tx.user.update).not.toHaveBeenCalled();
      expect(h.audit.record).not.toHaveBeenCalled();
    });

    it('throws 404 when the target is not a STAFF account', async () => {
      h.tx.user.findFirst.mockResolvedValue(null);
      await expect(h.service.rename('admin-1', { name: 'X' }, 'admin-1')).rejects.toThrow(NotFoundException);
      expect(h.tx.user.findFirst).toHaveBeenCalledWith({ where: { id: 'admin-1', role: 'STAFF' } });
    });
  });

  describe('disable / enable', () => {
    it('disabling bumps sessionVersion, revokes refresh tokens and audits once', async () => {
      h.tx.user.findFirst.mockResolvedValue(staff());
      h.tx.user.update.mockResolvedValue(staff({ status: 'DISABLED' }));

      const result = await h.service.disable('s1', 'admin-1');

      expect(result.status).toBe('DISABLED');
      expect(h.tx.user.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'DISABLED', sessionVersion: { increment: 1 } },
      });
      expect(h.tx.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 's1', revokedAt: null } }),
      );
      expect(h.audit.record).toHaveBeenCalledWith(h.tx, expect.objectContaining({ action: 'staff.disable' }));
    });

    it('disabling an already DISABLED staff changes nothing', async () => {
      h.tx.user.findFirst.mockResolvedValue(staff({ status: 'DISABLED' }));

      await h.service.disable('s1', 'admin-1');

      expect(h.tx.user.update).not.toHaveBeenCalled();
      expect(h.audit.record).not.toHaveBeenCalled();
    });

    it('enabling restores ACTIVE without touching sessions', async () => {
      h.tx.user.findFirst.mockResolvedValue(staff({ status: 'DISABLED' }));
      h.tx.user.update.mockResolvedValue(staff());

      await h.service.enable('s1', 'admin-1');

      expect(h.tx.user.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { status: 'ACTIVE' } });
      expect(h.tx.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(h.audit.record).toHaveBeenCalledWith(h.tx, expect.objectContaining({ action: 'staff.enable' }));
    });
  });
});
