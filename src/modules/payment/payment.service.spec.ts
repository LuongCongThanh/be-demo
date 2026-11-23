import { ConflictException } from '@nestjs/common';
import {
  PaymentConfirmationSource,
  PaymentGateway,
  PaymentStatus,
  OrderStatus,
  PaymentMethod,
  InventoryReservationStatus,
} from '#src/generated/prisma/enums.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '#src/generated/prisma/client.js';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { fingerprint } from '#src/modules/checkout/domain/checkout-pricing.js';
import { PaymentsService } from '#src/modules/payment/payment.service.js';
import type { PaymentGateway as PaymentGatewayContract } from '#src/modules/payment/payment-gateway.js';

describe('PaymentsService', () => {
  const tx = {
    $queryRaw: vi.fn(),
    idempotencyKey: { create: vi.fn(), update: vi.fn() },
    order: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    payment: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    paymentNotification: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    orderItem: { findMany: vi.fn() },
    inventoryReservation: { findMany: vi.fn(), update: vi.fn() },
    inventory: { findMany: vi.fn(), updateMany: vi.fn() },
    inventoryMovement: { create: vi.fn() },
    awaitingDispatchItem: { createMany: vi.fn() },
    refund: { findUnique: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
    orderFlag: { upsert: vi.fn() },
    outboxEvent: { create: vi.fn() },
    voucherUsage: { findMany: vi.fn(), updateMany: vi.fn() },
    voucher: { updateMany: vi.fn() },
  };
  const prismaMock = {
    $transaction: vi.fn(),
    idempotencyKey: { findUnique: vi.fn() },
    payment: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    order: { findMany: vi.fn() },
    paymentNotification: { findUnique: vi.fn() },
  };
  const configMock = {
    get: vi.fn((name: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        PUBLIC_API_URL: 'https://api.example.test',
        FRONTEND_URL: 'https://shop.example.test',
      };
      return values[name] ?? defaultValue;
    }),
  };
  const gateway: PaymentGatewayContract = {
    gateway: PaymentGateway.VNPAY,
    createPaymentLink: vi.fn().mockResolvedValue('https://sandbox.vnpayment.vn/payment'),
    verifyNotification: vi.fn(),
    queryPayment: vi.fn(),
  };
  const service = new PaymentsService(
    prismaMock as unknown as PrismaService,
    configMock as unknown as ConfigService,
    new Map([[PaymentGateway.VNPAY, gateway]]),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (transaction: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(tx as unknown as Prisma.TransactionClient),
    );
    tx.$queryRaw.mockResolvedValue([{ id: 'order-1' }]);
    tx.idempotencyKey.create.mockResolvedValue({});
    tx.idempotencyKey.update.mockResolvedValue({});
    tx.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'FS2611-7K3QZD',
      userId: null,
      status: OrderStatus.PENDING_PAYMENT,
      paymentMethod: PaymentMethod.ONLINE,
      total: 230_000n,
      placedAt: new Date(Date.now() - 60_000),
    });
    tx.payment.create.mockResolvedValue({});
    tx.payment.updateMany.mockResolvedValue({ count: 1 });
    tx.paymentNotification.findUnique.mockResolvedValue(null);
    tx.paymentNotification.create.mockResolvedValue({ id: 'notification-1' });
    tx.paymentNotification.update.mockResolvedValue({});
    tx.orderItem.findMany.mockResolvedValue([{ variantId: 'variant-1', quantity: 2 }]);
    tx.inventoryReservation.findMany.mockResolvedValue([
      {
        id: 'reservation-1',
        variantId: 'variant-1',
        quantity: 2,
        status: InventoryReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);
    tx.inventory.findMany.mockResolvedValue([{ variantId: 'variant-1', quantity: 5, reservedQuantity: 2 }]);
    tx.inventory.updateMany.mockResolvedValue({ count: 1 });
    tx.inventoryMovement.create.mockResolvedValue({});
    tx.inventoryReservation.update.mockResolvedValue({});
    tx.awaitingDispatchItem.createMany.mockResolvedValue({ count: 1 });
    tx.payment.update.mockResolvedValue({});
    tx.order.update.mockResolvedValue({});
    tx.refund.findUnique.mockResolvedValue(null);
    tx.refund.aggregate.mockResolvedValue({ _sum: { amount: null } });
    tx.refund.create.mockResolvedValue({});
    tx.orderFlag.upsert.mockResolvedValue({});
    tx.outboxEvent.create.mockResolvedValue({});
    tx.voucherUsage.findMany.mockResolvedValue([]);
    tx.voucherUsage.updateMany.mockResolvedValue({ count: 1 });
    tx.voucher.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.idempotencyKey.findUnique.mockResolvedValue(null);
    prismaMock.paymentNotification.findUnique.mockResolvedValue(null);
    prismaMock.order.findMany.mockResolvedValue([]);
  });

  afterEach(() => vi.useRealTimers());

  it('creates one payment attempt and persists its provider URL for idempotent replay', async () => {
    const expiresAt = new Date(Date.now() - 60_000 + 10 * 60_000);
    const dto = { quoteId: '0193e4d4-0b53-7a8b-9f2d-c2a4dcab249f', gateway: PaymentGateway.VNPAY };
    const payment = {
      id: 'payment-1',
      orderId: 'order-1',
      gateway: PaymentGateway.VNPAY,
      gatewayTxnRef: 'txref-1',
      amountRequested: 230_000n,
      paymentUrl: null,
      paymentUrlExpiresAt: expiresAt,
      status: PaymentStatus.PENDING,
      order: { orderNumber: 'FS2611-7K3QZD', placedAt: new Date(Date.now() - 60_000) },
    };
    tx.payment.create.mockResolvedValue(payment);
    prismaMock.payment.findUnique.mockResolvedValue(payment);
    tx.payment.findUnique.mockResolvedValue({ ...payment, paymentUrl: 'https://sandbox.vnpayment.vn/payment' });

    const result = await service.createAttempt(dto, 'attempt-1', undefined, '203.0.113.1');

    expect(result).toEqual({
      paymentId: 'payment-1',
      gateway: PaymentGateway.VNPAY,
      paymentUrl: 'https://sandbox.vnpayment.vn/payment',
      expiresAt,
    });
    expect(gateway.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayTxnRef: 'txref-1',
        amount: 230_000n,
        expiresAt,
        returnUrl: expect.stringContaining('status=pending_confirmation'),
        ipnUrl: 'https://api.example.test/api/v1/payments/webhooks/vnpay',
      }),
    );
    expect(tx.payment.create).toHaveBeenCalledOnce();
    expect(tx.idempotencyKey.update).toHaveBeenCalledTimes(2);
  });

  it('rejects new payment attempts once the seven-minute retry window closes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T12:07:00.000Z'));
    tx.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'FS2611-7K3QZD',
      userId: null,
      status: OrderStatus.PENDING_PAYMENT,
      paymentMethod: PaymentMethod.ONLINE,
      total: 230_000n,
      placedAt: new Date('2026-11-22T12:00:00.000Z'),
    });

    await expect(
      service.createAttempt(
        { quoteId: '0193e4d4-0b53-7a8b-9f2d-c2a4dcab249f', gateway: PaymentGateway.VNPAY },
        'late-attempt',
        undefined,
        '203.0.113.1',
      ),
    ).rejects.toThrow(ConflictException);
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('deducts held stock and places the order only after a verified capture', async () => {
    const captured = {
      gatewayTxnRef: 'txref-1',
      dedupKey: 'capture-1',
      status: 'CAPTURED' as const,
      amountCaptured: 230_000n,
      gatewayTxnId: 'gateway-transaction-1',
    };
    vi.mocked(gateway.verifyNotification).mockReturnValue(captured);
    tx.payment.findUnique
      .mockResolvedValueOnce({ id: 'payment-1', orderId: 'order-1', gateway: PaymentGateway.VNPAY })
      .mockResolvedValueOnce({
        id: 'payment-1',
        orderId: 'order-1',
        gateway: PaymentGateway.VNPAY,
        gatewayTxnRef: 'txref-1',
        gatewayTxnId: null,
        amountRequested: 230_000n,
        amountCaptured: null,
        status: PaymentStatus.PENDING,
        confirmedVia: null,
        succeededAt: null,
      });
    tx.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'FS2611-7K3QZD',
      status: OrderStatus.PENDING_PAYMENT,
      paymentMethod: PaymentMethod.ONLINE,
      total: 230_000n,
      placedAt: new Date(Date.now() - 60_000),
    });

    await service.handleNotification(PaymentGateway.VNPAY, { vnp_TxnRef: 'txref-1' });

    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment-1' },
        data: expect.objectContaining({
          status: PaymentStatus.SUCCEEDED,
          amountCaptured: 230_000n,
          confirmedVia: PaymentConfirmationSource.IPN,
        }),
      }),
    );
    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: { variantId: 'variant-1', quantity: { gte: 2 }, reservedQuantity: { gte: 2 } },
      data: { quantity: { decrement: 2 }, reservedQuantity: { decrement: 2 } },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantityDelta: -2,
        beforeQuantity: 5,
        afterQuantity: 3,
        beforeReserved: 2,
        afterReserved: 0,
      }),
    });
    expect(tx.inventoryReservation.update).toHaveBeenCalledWith({
      where: { id: 'reservation-1' },
      data: { status: InventoryReservationStatus.CONVERTED, resolvedAt: expect.any(Date) },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: OrderStatus.PLACED },
    });
    expect(tx.awaitingDispatchItem.createMany).toHaveBeenCalledOnce();
  });

  it('requests a refund and flags the order when captured amount does not match', async () => {
    vi.mocked(gateway.verifyNotification).mockReturnValue({
      gatewayTxnRef: 'txref-1',
      dedupKey: 'capture-mismatch',
      status: 'CAPTURED',
      amountCaptured: 200_000n,
    });
    tx.payment.findUnique
      .mockResolvedValueOnce({ id: 'payment-1', orderId: 'order-1', gateway: PaymentGateway.VNPAY })
      .mockResolvedValueOnce({
        id: 'payment-1',
        orderId: 'order-1',
        gateway: PaymentGateway.VNPAY,
        gatewayTxnRef: 'txref-1',
        gatewayTxnId: null,
        amountRequested: 230_000n,
        amountCaptured: null,
        status: PaymentStatus.PENDING,
        confirmedVia: null,
        succeededAt: null,
      })
      .mockResolvedValueOnce({ amountCaptured: 200_000n });
    tx.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'FS2611-7K3QZD',
      status: OrderStatus.PENDING_PAYMENT,
      paymentMethod: PaymentMethod.ONLINE,
      total: 230_000n,
      placedAt: new Date(Date.now() - 60_000),
    });

    await service.handleNotification(PaymentGateway.VNPAY, { vnp_TxnRef: 'txref-1' });

    expect(tx.refund.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        paymentId: 'payment-1',
        reason: 'AMOUNT_MISMATCH',
        amount: 200_000n,
        status: 'REQUESTED',
      },
    });
    expect(tx.orderFlag.upsert).toHaveBeenCalledOnce();
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('refunds a verified capture for an order that is already cancelled', async () => {
    vi.mocked(gateway.verifyNotification).mockReturnValue({
      gatewayTxnRef: 'txref-1',
      dedupKey: 'late-capture',
      status: 'CAPTURED',
      amountCaptured: 230_000n,
    });
    tx.payment.findUnique
      .mockResolvedValueOnce({ id: 'payment-1', orderId: 'order-1', gateway: PaymentGateway.VNPAY })
      .mockResolvedValueOnce({
        id: 'payment-1',
        orderId: 'order-1',
        gateway: PaymentGateway.VNPAY,
        gatewayTxnRef: 'txref-1',
        gatewayTxnId: null,
        amountRequested: 230_000n,
        amountCaptured: null,
        status: PaymentStatus.EXPIRED,
        confirmedVia: null,
        succeededAt: null,
      })
      .mockResolvedValueOnce({ amountCaptured: 230_000n });
    tx.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'FS2611-7K3QZD',
      status: OrderStatus.CANCELLED,
      paymentMethod: PaymentMethod.ONLINE,
      total: 230_000n,
      placedAt: new Date(Date.now() - 16 * 60_000),
    });

    await service.handleNotification(PaymentGateway.VNPAY, { vnp_TxnRef: 'txref-1' });

    expect(tx.refund.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        paymentId: 'payment-1',
        reason: 'UNEXPECTED_PAYMENT',
        amount: 230_000n,
        status: 'REQUESTED',
      },
    });
    expect(tx.orderFlag.upsert).toHaveBeenCalledOnce();
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });

  it('does not process a duplicate notification twice', async () => {
    vi.mocked(gateway.verifyNotification).mockReturnValue({
      gatewayTxnRef: 'txref-1',
      dedupKey: 'already-processed',
      status: 'CAPTURED',
      amountCaptured: 230_000n,
    });
    tx.paymentNotification.findUnique.mockResolvedValue({
      id: 'notification-1',
      processedAt: new Date(),
    });

    await service.handleNotification(PaymentGateway.VNPAY, { vnp_TxnRef: 'txref-1' });

    expect(tx.payment.findUnique).not.toHaveBeenCalled();
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('releases reserved stock and voucher usage when an online order expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T12:16:00.000Z'));
    prismaMock.order.findMany.mockResolvedValue([{ id: 'order-1' }]);
    tx.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'FS2611-7K3QZD',
      status: OrderStatus.PENDING_PAYMENT,
      placedAt: new Date('2026-11-22T12:00:00.000Z'),
    });
    tx.inventoryReservation.findMany.mockResolvedValue([
      {
        id: 'reservation-1',
        variantId: 'variant-1',
        quantity: 2,
        status: InventoryReservationStatus.ACTIVE,
        expiresAt: new Date('2026-11-22T12:15:00.000Z'),
      },
    ]);
    tx.voucherUsage.findMany.mockResolvedValue([{ id: 'usage-1', voucherId: 'voucher-1' }]);

    await service.expirePendingOrders();

    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: { variantId: 'variant-1', reservedQuantity: { gte: 2 } },
      data: { reservedQuantity: { decrement: 2 } },
    });
    expect(tx.inventoryReservation.update).toHaveBeenCalledWith({
      where: { id: 'reservation-1' },
      data: { status: InventoryReservationStatus.EXPIRED, resolvedAt: expect.any(Date) },
    });
    expect(tx.voucher.updateMany).toHaveBeenCalledWith({
      where: { id: 'voucher-1', usedCount: { gte: 1 } },
      data: { usedCount: { decrement: 1 } },
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: OrderStatus.PENDING_PAYMENT },
      data: { status: OrderStatus.CANCELLED },
    });
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1', status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.EXPIRED },
    });
  });

  it('replays a completed idempotency key without creating another payment', async () => {
    const dto = { quoteId: '0193e4d4-0b53-7a8b-9f2d-c2a4dcab249f', gateway: PaymentGateway.VNPAY };
    const response = {
      paymentId: 'payment-1',
      gateway: PaymentGateway.VNPAY,
      paymentUrl: 'https://sandbox.vnpayment.vn/payment',
      expiresAt: '2026-11-22T12:10:00.000Z',
    };
    prismaMock.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: fingerprint({ body: dto, userId: null }),
      response,
    });

    const result = await service.createAttempt(dto, 'attempt-1', undefined, '203.0.113.1');

    expect(result).toEqual({ ...response, expiresAt: new Date(response.expiresAt) });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(gateway.createPaymentLink).not.toHaveBeenCalled();
  });
});
