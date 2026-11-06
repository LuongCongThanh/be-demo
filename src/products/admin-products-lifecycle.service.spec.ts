import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '#src/generated/prisma/client.js';
import { AdminProductsService } from '#src/products/admin-products.service.js';
import type { PrismaService } from '#src/prisma/prisma.service.js';

const product = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  categoryId: 'cat',
  name: 'Ao',
  slug: 'ao',
  status: 'DRAFT',
  publishedAt: null,
  ...over,
});
const variantRow = {
  id: 'v1',
  productId: 'p1',
  sizeId: 's1',
  colorId: 'c1',
  sku: 'AO-M',
  price: 100000n,
  status: 'ACTIVE',
  size: { id: 's1', code: 'M', name: 'M' },
  color: { id: 'c1', code: 'WHT', name: 'Trắng', hex: '#FFFFFF' },
};

function setup() {
  const tx = { productVariant: { create: vi.fn() }, inventory: { create: vi.fn() } };
  const prisma = {
    product: {
      findUnique: vi.fn(),
      update: vi.fn((a: { data: Record<string, unknown> }) => ({ ...product(), ...a.data })),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    productVariant: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
    size: { findUnique: vi.fn() },
    color: { findUnique: vi.fn() },
    category: { findUnique: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma, tx, service: new AdminProductsService(prisma as unknown as PrismaService) };
}

describe('AdminProductsService — lifecycle (BR-CAT-07, BR-CAT-09)', () => {
  let h: ReturnType<typeof setup>;
  beforeEach(() => {
    h = setup();
  });

  it('publishing a DRAFT sets publishedAt the first time', async () => {
    h.prisma.product.findUnique.mockResolvedValue(product());
    await h.service.update('p1', { status: 'ACTIVE' });

    const data = h.prisma.product.update.mock.calls[0][0].data;
    expect(data.status).toBe('ACTIVE');
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it('re-activating keeps the first publishedAt', async () => {
    h.prisma.product.findUnique.mockResolvedValue(product({ status: 'ARCHIVED', publishedAt: new Date(1) }));
    await h.service.unarchive('p1');

    expect(h.prisma.product.update.mock.calls[0][0].data).toEqual({ status: 'ACTIVE' });
  });

  it.each(['ACTIVE', 'ARCHIVED'])('moving %s back to DRAFT is a 400', async (status) => {
    h.prisma.product.findUnique.mockResolvedValue(product({ status }));
    await expect(h.service.update('p1', { status: 'DRAFT' })).rejects.toThrow(BadRequestException);
  });

  it('archive is idempotent: an ARCHIVED product is returned untouched', async () => {
    h.prisma.product.findUnique.mockResolvedValue(product({ status: 'ARCHIVED' }));
    await h.service.archive('p1');
    expect(h.prisma.product.update).not.toHaveBeenCalled();
  });

  it('a DRAFT can be archived without being published', async () => {
    h.prisma.product.findUnique.mockResolvedValue(product());
    await h.service.archive('p1');
    expect(h.prisma.product.update.mock.calls[0][0].data).toEqual({ status: 'ARCHIVED' });
  });

  it('unarchiving a DRAFT is a 400', async () => {
    h.prisma.product.findUnique.mockResolvedValue(product());
    await expect(h.service.unarchive('p1')).rejects.toThrow(BadRequestException);
  });

  it('archive of a missing product is a 404', async () => {
    h.prisma.product.findUnique.mockResolvedValue(null);
    await expect(h.service.archive('p1')).rejects.toThrow(NotFoundException);
  });

  it('findAll filters by status and category', async () => {
    h.prisma.product.findMany.mockResolvedValue([]);
    h.prisma.product.count.mockResolvedValue(0);
    await h.service.findAll({ page: 1, limit: 20, status: 'DRAFT', categoryId: 'cat' });
    expect(h.prisma.product.findMany.mock.calls[0][0].where).toEqual({ categoryId: 'cat', status: 'DRAFT' });
  });

  it('findOne returns every variant mapped with integer prices', async () => {
    h.prisma.product.findUnique.mockResolvedValue({ ...product(), variants: [variantRow], images: [] });
    const result = await h.service.findOne('p1');
    expect(result.variants[0].price).toBe(100000);
  });
});

describe('AdminProductsService — variant rules (BR-CAT-02..04)', () => {
  let h: ReturnType<typeof setup>;
  const dto = { sku: 'AO-M', sizeId: 's1', colorId: 'c1', price: 100000 };

  beforeEach(() => {
    h = setup();
    h.prisma.product.findUnique.mockResolvedValue(product());
    h.prisma.size.findUnique.mockResolvedValue({ isHidden: false });
    h.prisma.color.findUnique.mockResolvedValue({ isHidden: false });
    h.prisma.productVariant.findUnique.mockResolvedValue(null);
  });

  it('creates the variant and its inventory row, returning an integer price', async () => {
    h.tx.productVariant.create.mockResolvedValue(variantRow);

    const result = await h.service.createVariant('p1', dto);

    expect(h.tx.inventory.create).toHaveBeenCalledWith({ data: { variantId: 'v1', quantity: 0, reservedQuantity: 0 } });
    expect(result.price).toBe(100000);
  });

  it.each([
    ['size', 'size'],
    ['color', 'color'],
  ] as const)('rejects a hidden or unknown %s with 400', async (_label, model) => {
    h.prisma[model].findUnique.mockResolvedValueOnce({ isHidden: true });
    await expect(h.service.createVariant('p1', dto)).rejects.toThrow(BadRequestException);
    h.prisma[model].findUnique.mockResolvedValueOnce(null);
    await expect(h.service.createVariant('p1', dto)).rejects.toThrow(BadRequestException);
  });

  it('rejects a taken SKU or a duplicate size × color with 409 before writing', async () => {
    h.prisma.productVariant.findUnique.mockResolvedValueOnce({ id: 'x' }).mockResolvedValueOnce(null);
    await expect(h.service.createVariant('p1', dto)).rejects.toThrow(/SKU/);

    h.prisma.productVariant.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'x' });
    await expect(h.service.createVariant('p1', dto)).rejects.toThrow(/size and color/);
    expect(h.tx.productVariant.create).not.toHaveBeenCalled();
  });

  it.each([
    [['sku'], /SKU/],
    [['product_id', 'size_id', 'color_id'], /size and color/],
  ])('maps a racing P2002 on %j to 409', async (target, message) => {
    h.tx.productVariant.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x', meta: { target } }),
    );
    const call = h.service.createVariant('p1', dto);
    await expect(call).rejects.toThrow(ConflictException);
    await expect(call).rejects.toThrow(message);
  });

  it('variant status changes are idempotent', async () => {
    h.prisma.productVariant.findFirst.mockResolvedValue({ ...variantRow, status: 'ARCHIVED' });
    h.prisma.productVariant.findUniqueOrThrow.mockResolvedValue({ ...variantRow, status: 'ARCHIVED' });

    await h.service.setVariantStatus('p1', 'v1', 'ARCHIVED');
    expect(h.prisma.productVariant.update).not.toHaveBeenCalled();

    h.prisma.productVariant.update.mockResolvedValue(variantRow);
    await h.service.setVariantStatus('p1', 'v1', 'ACTIVE');
    expect(h.prisma.productVariant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE' } }),
    );
  });

  it('updateVariant 404s for a variant of another product', async () => {
    h.prisma.productVariant.findFirst.mockResolvedValue(null);
    await expect(h.service.updateVariant('p2', 'v1', { price: 1 })).rejects.toThrow(NotFoundException);
  });

  it('updateVariant writes only price/status and returns an integer price', async () => {
    h.prisma.productVariant.findFirst.mockResolvedValue(variantRow);
    h.prisma.productVariant.update.mockResolvedValue({ ...variantRow, price: 120000n });

    const result = await h.service.updateVariant('p1', 'v1', { price: 120000 });

    expect(h.prisma.productVariant.update.mock.calls[0][0].data).toEqual({ price: 120000 });
    expect(result.price).toBe(120000);
  });
});
