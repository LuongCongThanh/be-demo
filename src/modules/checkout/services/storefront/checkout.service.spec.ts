import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '#src/generated/prisma/client.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutService } from '#src/modules/checkout/services/storefront/checkout.service.js';
import { fingerprint } from '#src/modules/checkout/domain/checkout-pricing.js';
import type { CreateCheckoutQuoteDto } from '#src/modules/checkout/dto/storefront/create-checkout-quote.dto.js';
import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';

const request: CreateCheckoutQuoteDto = {
  items: [{ variantId: 'variant-1', quantity: 2 }],
  contactName: 'Nguyen Van A',
  contactPhone: '0901234567',
  shippingProvinceCode: '79',
  shippingWardCode: '26734',
  shippingAddress: '123 Nguyen Hue',
};

const variant = {
  id: 'variant-1',
  sku: 'TEE-WHT-M',
  price: 100_000n,
  product: { name: 'Basic Tee', weightGrams: 200 },
  size: { name: 'M' },
  color: { name: 'White' },
  inventory: { quantity: 5, reservedQuantity: 1 },
};

describe('CheckoutService', () => {
  const tx = {
    $queryRaw: vi.fn(),
    idempotencyKey: { create: vi.fn(), update: vi.fn() },
    checkoutQuote: { findUnique: vi.fn() },
    productVariant: { findMany: vi.fn() },
    salePrice: { findMany: vi.fn() },
    voucher: { findUnique: vi.fn(), update: vi.fn() },
    voucherUsage: { count: vi.fn(), create: vi.fn() },
    inventory: { updateMany: vi.fn() },
    inventoryReservation: { createMany: vi.fn() },
    inventoryMovement: { createMany: vi.fn() },
    awaitingDispatchItem: { createMany: vi.fn() },
    order: { create: vi.fn(), findUnique: vi.fn() },
  };
  const prismaMock = {
    $transaction: vi.fn(),
    idempotencyKey: { findFirst: vi.fn() },
    checkoutQuote: { create: vi.fn() },
    productVariant: { findMany: vi.fn() },
    salePrice: { findMany: vi.fn() },
    voucher: { findUnique: vi.fn() },
    voucherUsage: { count: vi.fn() },
  };
  const service = new CheckoutService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T12:00:00.000Z'));

    prismaMock.productVariant.findMany.mockResolvedValue([variant]);
    prismaMock.salePrice.findMany.mockResolvedValue([]);
    prismaMock.voucher.findUnique.mockResolvedValue(null);
    prismaMock.voucherUsage.count.mockResolvedValue(0);
    prismaMock.checkoutQuote.create.mockImplementation(async ({ data }: Prisma.CheckoutQuoteCreateArgs) => ({
      id: 'quote-1',
      createdAt: new Date(),
      ...data,
    }));

    tx.$queryRaw.mockResolvedValue([{ id: 'quote-1' }]);
    tx.idempotencyKey.create.mockResolvedValue({});
    tx.idempotencyKey.update.mockResolvedValue({});
    tx.productVariant.findMany.mockResolvedValue([variant]);
    tx.salePrice.findMany.mockResolvedValue([]);
    tx.voucher.findUnique.mockResolvedValue(null);
    tx.voucherUsage.count.mockResolvedValue(0);
    tx.inventory.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'FS2611-7K3QZD',
      status: 'PLACED',
      paymentMethod: 'COD',
      subtotal: 200_000n,
      discountAmount: 0n,
      shippingFee: 30_000n,
      total: 230_000n,
      placedAt: new Date(),
    });
    tx.awaitingDispatchItem.createMany.mockResolvedValue({ count: 1 });
    tx.inventoryMovement.createMany.mockResolvedValue({ count: 1 });
    prismaMock.idempotencyKey.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(
      async (callback: (transaction: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(tx as unknown as Prisma.TransactionClient),
    );
  });

  it('quotes the effective price and available stock for fifteen minutes without reserving inventory', async () => {
    prismaMock.salePrice.findMany.mockResolvedValue([{ variantId: 'variant-1', price: 80_000n }]);

    const result = await service.quote(request);

    expect(result.items[0]).toMatchObject({
      listPrice: 100_000,
      unitPrice: 80_000,
      availableQuantity: 4,
      lineTotal: 160_000,
    });
    expect(result.shippingFee).toBe(30_000);
    expect(result.expiresAt.toISOString()).toBe('2026-11-22T12:15:00.000Z');
    expect(prismaMock.checkoutQuote.create).toHaveBeenCalledOnce();
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });

  it('rejects quote totals that cannot be represented exactly in the numeric API contract', async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([{ ...variant, price: BigInt(Number.MAX_SAFE_INTEGER) }]);

    await expect(service.quote(request)).rejects.toThrow(BadRequestException);
    expect(prismaMock.checkoutQuote.create).not.toHaveBeenCalled();
  });

  it('rejects shipment weights that exceed the database integer range', async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([
      { ...variant, product: { ...variant.product, weightGrams: 2_147_483_647 } },
    ]);

    await expect(service.quote(request)).rejects.toThrow(BadRequestException);
    expect(prismaMock.checkoutQuote.create).not.toHaveBeenCalled();
  });

  it('places a COD order and decrements stock in the same transaction', async () => {
    await service.quote(request);
    const quoteData = prismaMock.checkoutQuote.create.mock.calls[0][0].data;
    tx.checkoutQuote.findUnique.mockResolvedValue({
      id: 'quote-1',
      userId: null,
      input: quoteData.input,
      fingerprint: quoteData.fingerprint,
      expiresAt: quoteData.expiresAt,
    });

    const result = await service.placeCod({ quoteId: 'quote-1' }, 'key-1');

    expect(result).toMatchObject({ id: 'order-1', paymentMethod: 'COD', total: 230_000 });
    expect(tx.inventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { variantId: 'variant-1', quantity: { gte: 3 } },
        data: { quantity: { decrement: 2 } },
      }),
    );
    expect(tx.order.create).toHaveBeenCalledOnce();
    expect(tx.awaitingDispatchItem.createMany).toHaveBeenCalledWith({
      data: [{ orderId: 'order-1', variantId: 'variant-1', quantity: 2 }],
    });
    expect(tx.idempotencyKey.update).toHaveBeenCalledOnce();
  });

  it('places an online order by reserving stock for fifteen minutes without decrementing it', async () => {
    await service.quote(request);
    const quoteData = prismaMock.checkoutQuote.create.mock.calls[0][0].data;
    tx.checkoutQuote.findUnique.mockResolvedValue({
      id: 'quote-1',
      userId: null,
      input: quoteData.input,
      fingerprint: quoteData.fingerprint,
      expiresAt: quoteData.expiresAt,
    });
    tx.order.create.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'FS2611-7K3QZD',
      status: 'PENDING_PAYMENT',
      paymentMethod: 'ONLINE',
      subtotal: 200_000n,
      discountAmount: 0n,
      shippingFee: 30_000n,
      total: 230_000n,
      placedAt: new Date('2026-11-22T12:00:00.000Z'),
    });

    const result = await service.placeOnline({ quoteId: 'quote-1' }, 'online-key-1');

    expect(result).toMatchObject({ id: 'order-1', status: 'PENDING_PAYMENT', paymentMethod: 'ONLINE' });
    expect(tx.inventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { variantId: 'variant-1', quantity: { gte: 3 } },
        data: { reservedQuantity: { increment: 2 } },
      }),
    );
    expect(tx.inventoryReservation.createMany).toHaveBeenCalledWith({
      data: [
        {
          orderId: 'order-1',
          variantId: 'variant-1',
          quantity: 2,
          expiresAt: new Date('2026-11-22T12:15:00.000Z'),
        },
      ],
    });
    expect(tx.inventoryMovement.createMany).toHaveBeenCalledWith({
      data: [
        {
          variantId: 'variant-1',
          actorUserId: null,
          reason: 'Giữ hàng cho đơn online: FS2611-7K3QZD',
          quantityDelta: 0,
          beforeQuantity: 5,
          afterQuantity: 5,
          beforeReserved: 1,
          afterReserved: 3,
        },
      ],
    });
    expect(tx.awaitingDispatchItem.createMany).not.toHaveBeenCalled();
  });

  it('rejects a stale quote when the current sale price changes', async () => {
    await service.quote(request);
    const quoteData = prismaMock.checkoutQuote.create.mock.calls[0][0].data;
    tx.checkoutQuote.findUnique.mockResolvedValue({
      id: 'quote-1',
      userId: null,
      input: quoteData.input,
      fingerprint: quoteData.fingerprint,
      expiresAt: quoteData.expiresAt,
    });
    tx.salePrice.findMany.mockResolvedValue([{ variantId: 'variant-1', price: 90_000n }]);

    await expect(service.placeCod({ quoteId: 'quote-1' }, 'key-2')).rejects.toThrow(ConflictException);
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('replays a successful request for the same key and body, and rejects a different body', async () => {
    const response = {
      id: 'order-1',
      orderNumber: 'FS2611-7K3QZD',
      status: 'PLACED',
      paymentMethod: 'COD',
      subtotal: 200_000,
      discount: 0,
      shippingFee: 30_000,
      total: 230_000,
      placedAt: new Date(),
    };
    prismaMock.idempotencyKey.findFirst.mockResolvedValue({
      requestHash: fingerprint({ body: { quoteId: 'quote-1' }, userId: null }),
      response,
    });

    await expect(service.placeCod({ quoteId: 'quote-1' }, 'key-3')).resolves.toEqual(response);
    await expect(service.placeCod({ quoteId: 'quote-2' }, 'key-3')).rejects.toThrow(ConflictException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
