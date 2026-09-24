import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductVariant } from '@src/generated/prisma/client.js';
import type { PrismaService } from '@src/prisma/prisma.service.js';
import { MAX_LIVE_VARIANTS, ProductVariantsService } from '@src/products/product-variants.service.js';

const PRODUCT = { id: 'p1', code: 'TSB001' };
const OPTION_VALUES = [
  { id: 'black', code: 'BLK', type: 'COLOR' },
  { id: 'white', code: 'WHT', type: 'COLOR' },
  { id: 'm', code: 'M', type: 'SIZE' },
];

function variant(overrides: Partial<ProductVariant>): ProductVariant {
  return {
    id: 'v',
    productId: 'p1',
    sku: 'TSB001',
    status: 'ACTIVE',
    colorId: null,
    sizeId: null,
    ...overrides,
  } as ProductVariant;
}

describe('ProductVariantsService.plan', () => {
  const findMany = vi.fn();
  let service: ProductVariantsService;

  beforeEach(() => {
    // Mock chỉ trả Option Value đang hiện khớp id — như query thật (hidden: false).
    findMany
      .mockReset()
      .mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(OPTION_VALUES.filter((v) => where.id.in.includes(v.id))),
      );
    service = new ProductVariantsService({ optionValue: { findMany } } as unknown as PrismaService);
  });

  it('composes the SKU of each new variant from the Product Code and Option Value codes', async () => {
    const plan = await service.plan(
      PRODUCT,
      [],
      [
        { colorId: 'black', sizeId: 'm', price: 1 },
        { sizeId: 'm', price: 2 },
      ],
    );

    expect(plan.creates).toEqual([
      { sku: 'TSB001-BLK-M', colorId: 'black', sizeId: 'm', price: 1 },
      { sku: 'TSB001-M', colorId: undefined, sizeId: 'm', price: 2 },
    ]);
  });

  it('does not query Option Values when no new variant picks any', async () => {
    await service.plan(PRODUCT, [], [{ price: 1 }]);

    expect(findMany).not.toHaveBeenCalled();
  });

  it('keeps listed variants, discontinues the ones left out', async () => {
    const existing = [variant({ id: 'keep', sku: 'TSB001-BLK' }), variant({ id: 'drop', sku: 'TSB001-WHT' })];

    const plan = await service.plan(PRODUCT, existing, [{ id: 'keep', price: 5 }]);

    expect(plan.updates).toEqual([{ id: 'keep', price: 5, status: undefined }]);
    expect(plan.discontinueIds).toEqual(['drop']);
  });

  it.each([
    ['a missing price on a new variant', [{ colorId: 'black' }], 'A new variant requires a price'],
    ['an Option Value of the wrong type', [{ colorId: 'm', price: 1 }], /not selectable/],
    ['an unknown or hidden Option Value', [{ colorId: 'ghost', price: 1 }], /not selectable/],
  ])('rejects %s with 400', async (_label, entries, message) => {
    await expect(service.plan(PRODUCT, [], entries)).rejects.toThrow(BadRequestException);
    await expect(service.plan(PRODUCT, [], entries)).rejects.toThrow(message);
  });

  it('rejects a variant id that is not on the product, and changing color/size of a kept one, with 400', async () => {
    const existing = [variant({ id: 'v1', sku: 'TSB001-BLK', colorId: 'black' })];

    await expect(service.plan(PRODUCT, existing, [{ id: 'foreign', price: 1 }])).rejects.toThrow(
      /not found on product/,
    );
    await expect(service.plan(PRODUCT, existing, [{ id: 'v1', colorId: 'white' }])).rejects.toThrow(/cannot change/);
  });

  it('rejects a new SKU that collides with a sibling, including a discontinued one, with 409', async () => {
    const existing = [variant({ id: 'old', sku: 'TSB001-BLK', status: 'DISCONTINUED' }), variant({ id: 'v2' })];

    await expect(service.plan(PRODUCT, existing, [{ id: 'v2' }, { colorId: 'black', price: 1 }])).rejects.toThrow(
      new ConflictException('SKU "TSB001-BLK" already exists on this product'),
    );
  });

  it('never brings a discontinued variant back', async () => {
    const existing = [variant({ id: 'old', status: 'DISCONTINUED' }), variant({ id: 'live', sku: 'TSB001-W' })];

    await expect(service.plan(PRODUCT, existing, [{ id: 'live' }, { id: 'old', status: 'ACTIVE' }])).rejects.toThrow(
      /cannot return to sale/,
    );
  });

  it('requires at least one ACTIVE variant after the change', async () => {
    const existing = [variant({ id: 'v1' })];

    await expect(service.plan(PRODUCT, existing, [])).rejects.toThrow(/at least one ACTIVE variant/);
    await expect(service.plan(PRODUCT, existing, [{ id: 'v1', status: 'INACTIVE' }])).rejects.toThrow(
      /at least one ACTIVE variant/,
    );
  });

  it(`allows at most ${MAX_LIVE_VARIANTS} variants that are not DISCONTINUED`, async () => {
    const live = Array.from({ length: MAX_LIVE_VARIANTS }, (_, i) => variant({ id: `v${i}`, sku: `TSB001-${i}` }));
    const discontinued = variant({ id: 'gone', sku: 'TSB001-GONE', status: 'DISCONTINUED' });

    await expect(
      service.plan(PRODUCT, [...live, discontinued], [...live.map(({ id }) => ({ id })), { id: 'gone' }]),
    ).resolves.toBeDefined();
    await expect(
      service.plan(PRODUCT, live, [...live.map(({ id }) => ({ id })), { sizeId: 'm', price: 1 }]),
    ).rejects.toThrow(`at most ${MAX_LIVE_VARIANTS} variants`);
  });
});
