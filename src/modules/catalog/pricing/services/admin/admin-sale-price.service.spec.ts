import { ConflictException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { AdminSalePriceService } from '#src/modules/catalog/pricing/services/admin/admin-sale-price.service.js';

describe('AdminSalePriceService.end', () => {
  const activeSale = {
    id: 'sale-1',
    variantId: 'variant-1',
    price: 80_000n,
    startsAt: new Date('2026-11-22T00:00:00.000Z'),
    endsAt: new Date('2026-11-23T00:00:00.000Z'),
    createdById: 'user-1',
    createdAt: new Date('2026-11-22T00:00:00.000Z'),
    updatedAt: new Date('2026-11-22T00:00:00.000Z'),
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'variant-1' }]),
    salePrice: { findUnique: vi.fn(), update: vi.fn() },
  };
  const prismaMock = {
    salePrice: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  const service = new AdminSalePriceService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T12:00:00.000Z'));
    vi.clearAllMocks();
    prismaMock.salePrice.findUnique.mockResolvedValue({
      ...activeSale,
      variant: { price: 100_000n },
    });
    prismaMock.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );
    tx.salePrice.findUnique.mockResolvedValue(activeSale);
    tx.salePrice.update.mockImplementation(async ({ data }) => ({ ...activeSale, ...data }));
  });

  afterEach(() => vi.useRealTimers());

  it('locks the variant and rechecks the sale before ending it', async () => {
    await expect(service.end('sale-1')).resolves.toMatchObject({ status: 'ENDED', price: 80_000 });

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.salePrice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sale-1' }, data: { endsAt: expect.any(Date) } }),
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.salePrice.findUnique.mock.invocationCallOrder[0]);
  });

  it('rejects if another transaction ended the sale while this request waited for the variant lock', async () => {
    tx.salePrice.findUnique.mockResolvedValue({ ...activeSale, endsAt: new Date('2026-11-22T11:00:00.000Z') });

    await expect(service.end('sale-1')).rejects.toThrow(ConflictException);
    expect(tx.salePrice.update).not.toHaveBeenCalled();
  });
});
