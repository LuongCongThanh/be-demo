import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '#src/generated/prisma/client.js';
import { ProductOptionsService } from '#src/modules/catalog/services/product-options/product-options.service.js';
import type { PrismaService } from '#src/prisma/prisma.service.js';

describe('ProductOptionsService', () => {
  const prisma = {
    size: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    color: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  let service: ProductOptionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductOptionsService(prisma as unknown as PrismaService);
  });

  it('public lists exclude hidden options; back-office lists include them', async () => {
    await service.listSizes(false);
    await service.listSizes(true);
    await service.listColors(false);

    expect(prisma.size.findMany.mock.calls[0][0].where).toEqual({ isHidden: false });
    expect(prisma.size.findMany.mock.calls[1][0].where).toEqual({});
    expect(prisma.size.findMany.mock.calls[0][0].orderBy).toEqual([{ sortOrder: 'asc' }, { code: 'asc' }]);
    expect(prisma.color.findMany.mock.calls[0][0].where).toEqual({ isHidden: false });
  });

  it('normalises hex to uppercase on create and update', async () => {
    await service.createColor({ code: 'WHT', name: 'Trắng', hex: '#ffffff' });
    await service.updateColor('c1', { hex: '#abcdef' });
    await service.updateColor('c1', { name: 'Trắng ngà' });

    expect(prisma.color.create.mock.calls[0][0].data.hex).toBe('#FFFFFF');
    expect(prisma.color.update.mock.calls[0][0].data.hex).toBe('#ABCDEF');
    expect(prisma.color.update.mock.calls[1][0].data).toEqual({ name: 'Trắng ngà' });
  });

  it('maps a duplicate code to 409', async () => {
    const dup = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
      meta: { target: ['code'] },
    });
    prisma.size.create.mockRejectedValue(dup);
    prisma.color.create.mockRejectedValue(dup);

    await expect(service.createSize({ code: 'M', name: 'M', sortOrder: 1 })).rejects.toThrow(ConflictException);
    await expect(service.createColor({ code: 'W', name: 'W', hex: '#000000' })).rejects.toThrow(ConflictException);
  });

  it('updateSize passes the patch through', async () => {
    await service.updateSize('s1', { isHidden: true });
    expect(prisma.size.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' }, data: { isHidden: true } }),
    );
  });
});
