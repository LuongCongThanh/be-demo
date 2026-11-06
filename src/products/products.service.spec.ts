import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductsService } from '#src/products/products.service.js';
import type { PrismaService } from '#src/prisma/prisma.service.js';

const variant = {
  id: 'v1',
  productId: 'p1',
  sizeId: 's1',
  colorId: 'c1',
  sku: 'TSHIRT-M',
  price: 199000n,
  status: 'ACTIVE',
  size: { id: 's1', code: 'M', name: 'M' },
  color: { id: 'c1', code: 'WHT', name: 'Trắng', hex: '#FFFFFF' },
};

describe('ProductsService (storefront)', () => {
  const prisma = {
    product: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    productVariant: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  };
  let service: ProductsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductsService(prisma as unknown as PrismaService);
  });

  it('lists only ACTIVE products and ignores option filters when none are given', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(0);

    await service.findAll({ page: 1, limit: 20 });

    expect(prisma.product.findMany.mock.calls[0][0].where).toEqual({ status: 'ACTIVE' });
  });

  it('filters by visible size and color codes on a single ACTIVE variant', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(0);

    await service.findAll({ page: 1, limit: 20, categoryId: 'cat', size: ['M'], color: ['WHT'] });

    expect(prisma.product.findMany.mock.calls[0][0].where).toEqual({
      status: 'ACTIVE',
      categoryId: 'cat',
      variants: {
        some: {
          status: 'ACTIVE',
          size: { code: { in: ['M'] }, isHidden: false },
          color: { code: { in: ['WHT'] }, isHidden: false },
        },
      },
    });
  });

  it('findOne returns ACTIVE variants with integer prices', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'p1', variants: [variant], images: [] });

    const result = await service.findOne('p1');

    expect(result.variants[0]).toMatchObject({ price: 199000, size: { code: 'M' } });
    expect(result.variants[0]).not.toHaveProperty('sizeId');
  });

  it('findOne throws 404 for a hidden or missing product', async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    await expect(service.findOne('p1')).rejects.toThrow(NotFoundException);
  });

  it('findAllVariants 404s when the product is not visible', async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    await expect(service.findAllVariants('p1', { page: 1, limit: 20 })).rejects.toThrow(NotFoundException);
  });

  it('findAllVariants maps variants for a visible product', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'p1' });
    prisma.productVariant.findMany.mockResolvedValue([variant]);
    prisma.productVariant.count.mockResolvedValue(1);

    const result = await service.findAllVariants('p1', { page: 1, limit: 20 });

    expect(result.data[0].price).toBe(199000);
  });

  it('findOneVariant requires an ACTIVE variant of an ACTIVE product', async () => {
    prisma.productVariant.findFirst.mockResolvedValueOnce(variant).mockResolvedValueOnce(null);

    await expect(service.findOneVariant('p1', 'v1')).resolves.toMatchObject({ id: 'v1', price: 199000 });
    expect(prisma.productVariant.findFirst.mock.calls[0][0].where).toMatchObject({
      status: 'ACTIVE',
      product: { status: 'ACTIVE' },
    });
    await expect(service.findOneVariant('p1', 'v2')).rejects.toThrow(NotFoundException);
  });
});
