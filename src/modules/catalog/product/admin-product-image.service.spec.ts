import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '#src/generated/prisma/client.js';
import { AdminProductImageService } from '#src/modules/catalog/product/admin-product-image.service.js';
import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';

describe('AdminProductImageService', () => {
  const tx = { productImage: { updateMany: vi.fn(), create: vi.fn(), update: vi.fn() } };
  const prisma = {
    product: { findUnique: vi.fn() },
    color: { findUnique: vi.fn() },
    productImage: { findFirst: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  let service: AdminProductImageService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminProductImageService(prisma as unknown as PrismaService);
  });

  it('a new primary image demotes the current primary of the same color first', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.color.findUnique.mockResolvedValue({ id: 'c1' });

    await service.create('p1', { colorId: 'c1', storageKey: 'k', isPrimary: true });

    expect(tx.productImage.updateMany).toHaveBeenCalledWith({
      where: { productId: 'p1', colorId: 'c1', isPrimary: true },
      data: { isPrimary: false },
    });
    expect(tx.productImage.create).toHaveBeenCalledWith({
      data: { colorId: 'c1', storageKey: 'k', isPrimary: true, productId: 'p1' },
    });
  });

  it('a non-primary image does not demote anything', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.color.findUnique.mockResolvedValue({ id: 'c1' });

    await service.create('p1', { colorId: 'c1', storageKey: 'k' });

    expect(tx.productImage.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a missing product (404) or unknown color (400)', async () => {
    prisma.product.findUnique.mockResolvedValueOnce(null);
    prisma.color.findUnique.mockResolvedValueOnce({ id: 'c1' });
    await expect(service.create('p1', { colorId: 'c1', storageKey: 'k' })).rejects.toThrow(NotFoundException);

    prisma.product.findUnique.mockResolvedValueOnce({ id: 'p1' });
    prisma.color.findUnique.mockResolvedValueOnce(null);
    await expect(service.create('p1', { colorId: 'c1', storageKey: 'k' })).rejects.toThrow(BadRequestException);
  });

  it('maps a concurrent primary collision (P2002) to 409', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.color.findUnique.mockResolvedValue({ id: 'c1' });
    tx.productImage.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );

    await expect(service.create('p1', { colorId: 'c1', storageKey: 'k', isPrimary: true })).rejects.toThrow(
      ConflictException,
    );
  });

  it('promoting an image demotes only when it was not primary already', async () => {
    prisma.productImage.findFirst.mockResolvedValueOnce({ id: 'i1', colorId: 'c1', isPrimary: false });
    await service.update('p1', 'i1', { isPrimary: true });
    expect(tx.productImage.updateMany).toHaveBeenCalledTimes(1);

    prisma.productImage.findFirst.mockResolvedValueOnce({ id: 'i1', colorId: 'c1', isPrimary: true });
    await service.update('p1', 'i1', { isPrimary: true });
    expect(tx.productImage.updateMany).toHaveBeenCalledTimes(1);
  });

  it('update 404s for an image of another product', async () => {
    prisma.productImage.findFirst.mockResolvedValue(null);
    await expect(service.update('p1', 'i1', {})).rejects.toThrow(NotFoundException);
  });

  it('remove is scoped by product and 404s when nothing was deleted', async () => {
    prisma.productImage.deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await service.remove('p1', 'i1');
    expect(prisma.productImage.deleteMany).toHaveBeenCalledWith({ where: { id: 'i1', productId: 'p1' } });
    await expect(service.remove('p1', 'i2')).rejects.toThrow(NotFoundException);
  });
});
