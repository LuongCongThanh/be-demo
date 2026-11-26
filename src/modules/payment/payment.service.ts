import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { Prisma } from '#src/generated/prisma/client.js';
import {
  InventoryReservationStatus,
  OrderFlagType,
  OrderStatus,
  PaymentConfirmationSource,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  RefundReason,
  RefundStatus,
} from '#src/generated/prisma/enums.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { fingerprint } from '#src/modules/checkout/domain/checkout-pricing.js';
import type { CreatePaymentAttemptDto } from '#src/modules/payment/dto/create-payment-attempt.dto.js';
import type { PaymentLinkResponseDto } from '#src/modules/payment/dto/payment-link-response.dto.js';
import {
  PAYMENT_GATEWAYS,
  type PaymentGateway as PaymentGatewayContract,
  type PaymentGatewayMap,
  type PaymentLookup,
  type VerifiedPaymentNotification,
} from '#src/modules/payment/payment-gateway.js';

const PAYMENT_IDEMPOTENCY_SCOPE = 'payments.create-attempt';
const PAYMENT_LINK_TTL_MS = 10 * 60 * 1000;
const RETRY_CUTOFF_MS = 7 * 60 * 1000;
const RESERVATION_TTL_MS = 15 * 60 * 1000;
const RECONCILIATION_INTERVAL_MS = 5 * 60 * 1000;
const RECONCILIATION_BATCH_SIZE = 50;
const ORDER_EXPIRY_BATCH_SIZE = 100;

interface PaymentAttemptReservation {
  paymentId: string;
  response: Prisma.JsonValue | null;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(PAYMENT_GATEWAYS) private readonly gateways: PaymentGatewayMap,
  ) {}

  async createAttempt(
    dto: CreatePaymentAttemptDto,
    idempotencyKey: string | undefined,
    userId: string | undefined,
    clientIp: string,
  ): Promise<PaymentLinkResponseDto> {
    const key = normalizeIdempotencyKey(idempotencyKey);
    const requestHash = fingerprint({ body: dto, userId: userId ?? null });
    const reservation = await this.reserveAttempt(dto, key, requestHash, userId);
    if (reservation.response) {
      const replay = readPaymentLinkResponse(reservation.response);
      if (replay) return replay;
    }

    return this.createAndPersistLink(reservation.paymentId, dto.gateway, key, clientIp);
  }

  async handleNotification(gatewayName: PaymentGateway, payload: unknown): Promise<void> {
    const gateway = this.getGateway(gatewayName);
    const notification = gateway.verifyNotification(payload);
    await this.processVerifiedNotification(gatewayName, notification, payload, PaymentConfirmationSource.IPN);
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { waitForCompletion: true })
  async reconcilePendingPayments(): Promise<void> {
    const now = new Date();
    const payments = await this.prisma.payment.findMany({
      where: {
        status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.EXPIRED] },
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        OR: [
          { lastReconciledAt: null },
          { lastReconciledAt: { lte: new Date(now.getTime() - RECONCILIATION_INTERVAL_MS) } },
        ],
      },
      include: { order: { select: { orderNumber: true } } },
      orderBy: [{ lastReconciledAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
      take: RECONCILIATION_BATCH_SIZE,
    });

    for (const payment of payments) {
      try {
        const claimedAt = new Date();
        const claim = await this.prisma.payment.updateMany({
          where: {
            id: payment.id,
            status: payment.status,
            lastReconciledAt: payment.lastReconciledAt,
          },
          data: { lastReconciledAt: claimedAt },
        });
        if (claim.count !== 1) continue;

        const gateway = this.getGateway(payment.gateway);
        const lookup: PaymentLookup = {
          gatewayTxnRef: payment.gatewayTxnRef,
          orderNumber: payment.order.orderNumber,
          amountRequested: payment.amountRequested,
          createdAt: payment.createdAt,
        };
        const result = await gateway.queryPayment(lookup);
        if (result.status !== 'PENDING') {
          await this.processVerifiedNotification(
            payment.gateway,
            result,
            result,
            PaymentConfirmationSource.RECONCILIATION,
          );
        }
      } catch (error) {
        this.logger.error(
          `Payment reconciliation failed for payment ${payment.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async expirePendingOrders(): Promise<void> {
    const cutoff = new Date(Date.now() - RESERVATION_TTL_MS);
    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING_PAYMENT, placedAt: { lte: cutoff } },
      select: { id: true },
      orderBy: { placedAt: 'asc' },
      take: ORDER_EXPIRY_BATCH_SIZE,
    });

    for (const order of orders) {
      try {
        await this.expireOrder(order.id);
      } catch (error) {
        this.logger.error(
          `Pending order expiration failed for order ${order.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async reserveAttempt(
    dto: CreatePaymentAttemptDto,
    key: string,
    requestHash: string,
    userId?: string,
  ): Promise<PaymentAttemptReservation> {
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { scope_key: { scope: PAYMENT_IDEMPOTENCY_SCOPE, key } },
    });
    if (existing) return replayAttempt(existing.requestHash, requestHash, existing.response);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.idempotencyKey.create({
          data: { scope: PAYMENT_IDEMPOTENCY_SCOPE, key, requestHash },
        });

        const orderIds = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM orders WHERE quote_id = ${dto.quoteId}::uuid FOR UPDATE
        `;
        if (orderIds.length === 0) throw new NotFoundException('Online order not found');

        const order = await tx.order.findUnique({
          where: { quoteId: dto.quoteId },
          select: {
            id: true,
            orderNumber: true,
            userId: true,
            status: true,
            paymentMethod: true,
            total: true,
            placedAt: true,
          },
        });
        if (!order || order.userId !== (userId ?? null)) {
          throw new NotFoundException('Online order not found');
        }
        if (order.paymentMethod !== PaymentMethod.ONLINE || order.status !== OrderStatus.PENDING_PAYMENT) {
          throw new ConflictException('Order is not waiting for online payment');
        }

        const now = new Date();
        const retryCutoff = new Date(order.placedAt.getTime() + RETRY_CUTOFF_MS);
        if (now >= retryCutoff) {
          throw new ConflictException('The payment attempt window has closed');
        }

        const paymentId = randomUUID();
        await tx.payment.create({
          data: {
            id: paymentId,
            orderId: order.id,
            gateway: dto.gateway,
            gatewayTxnRef: randomUUID().replaceAll('-', ''),
            amountRequested: order.total,
            paymentUrlExpiresAt: new Date(order.placedAt.getTime() + PAYMENT_LINK_TTL_MS),
          },
        });
        await tx.idempotencyKey.update({
          where: { scope_key: { scope: PAYMENT_IDEMPOTENCY_SCOPE, key } },
          data: { responseStatus: 201, response: asJson({ paymentId }) },
        });
        return { paymentId, response: null };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const winner = await this.prisma.idempotencyKey.findUnique({
        where: { scope_key: { scope: PAYMENT_IDEMPOTENCY_SCOPE, key } },
      });
      if (winner) return replayAttempt(winner.requestHash, requestHash, winner.response);
      throw error;
    }
  }

  private async createAndPersistLink(
    paymentId: string,
    gatewayName: PaymentGateway,
    idempotencyKey: string,
    clientIp: string,
  ): Promise<PaymentLinkResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { orderNumber: true, placedAt: true } } },
    });
    if (!payment) throw new NotFoundException('Payment attempt not found');
    if (payment.paymentUrl) return paymentResponse(payment);
    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictException('Payment attempt is no longer pending');
    }
    if (Date.now() >= payment.order.placedAt.getTime() + RETRY_CUTOFF_MS) {
      throw new ConflictException('The payment attempt window has closed');
    }

    const publicApiUrl = requiredUrl(this.config, 'PUBLIC_API_URL');
    const frontendUrl = optionalUrl(this.config.get<string>('FRONTEND_URL')) ?? 'http://localhost:3000';
    const returnUrl = new URL('/payment/return', frontendUrl);
    returnUrl.searchParams.set('paymentId', payment.id);
    returnUrl.searchParams.set('status', 'pending_confirmation');
    const ipnUrl = new URL(`/api/v1/payments/webhooks/${gatewayName.toLowerCase()}`, publicApiUrl);
    const gateway = this.getGateway(gatewayName);
    const paymentUrl = await gateway.createPaymentLink({
      gatewayTxnRef: payment.gatewayTxnRef,
      orderNumber: payment.order.orderNumber,
      amount: payment.amountRequested,
      expiresAt: payment.paymentUrlExpiresAt,
      returnUrl: returnUrl.toString(),
      ipnUrl: ipnUrl.toString(),
      clientIp: normalizeClientIp(clientIp),
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { id: payment.id, paymentUrl: null },
        data: { paymentUrl },
      });
      const savedPayment = await tx.payment.findUnique({ where: { id: payment.id } });
      if (!savedPayment) throw new NotFoundException('Payment attempt not found');
      const response = paymentResponse(savedPayment);
      await tx.idempotencyKey.update({
        where: { scope_key: { scope: PAYMENT_IDEMPOTENCY_SCOPE, key: idempotencyKey } },
        data: { responseStatus: 201, response: asJson(response) },
      });
      return response;
    });
  }

  private async processVerifiedNotification(
    gatewayName: PaymentGateway,
    result: VerifiedPaymentNotification,
    rawPayload: unknown,
    source: PaymentConfirmationSource,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const dedupWhere = {
          gateway_dedupKey: { gateway: gatewayName, dedupKey: result.dedupKey },
        };
        const previous = await tx.paymentNotification.findUnique({ where: dedupWhere });
        if (previous?.processedAt) return;

        const initialPayment = await tx.payment.findUnique({
          where: { gatewayTxnRef: result.gatewayTxnRef },
          select: { id: true, orderId: true, gateway: true },
        });
        if (initialPayment) {
          await lockOrder(tx, initialPayment.orderId);
          await lockPayment(tx, initialPayment.id);
        }

        const notification =
          previous ??
          (await tx.paymentNotification.create({
            data: {
              gateway: gatewayName,
              dedupKey: result.dedupKey,
              paymentId: initialPayment?.gateway === gatewayName ? initialPayment.id : null,
              signatureValid: true,
              rawPayload: asJson(rawPayload),
            },
          }));

        if (!initialPayment || initialPayment.gateway !== gatewayName) {
          await tx.paymentNotification.update({
            where: { id: notification.id },
            data: { processedAt: new Date() },
          });
          return;
        }

        const payment = await tx.payment.findUnique({
          where: { id: initialPayment.id },
          select: {
            id: true,
            orderId: true,
            gateway: true,
            gatewayTxnRef: true,
            gatewayTxnId: true,
            amountRequested: true,
            amountCaptured: true,
            status: true,
            confirmedVia: true,
            succeededAt: true,
          },
        });
        const order = await tx.order.findUnique({
          where: { id: initialPayment.orderId },
          select: { id: true, orderNumber: true, status: true, paymentMethod: true, total: true, placedAt: true },
        });
        if (!payment || !order) throw new NotFoundException('Payment or order not found');

        if (result.status === 'CAPTURED') {
          await this.applyCapturedPayment(tx, payment, order, result, notification, source);
        } else if (result.status === 'FAILED' && payment.status === PaymentStatus.PENDING) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.FAILED },
          });
        }
        await tx.paymentNotification.update({
          where: { id: notification.id },
          data: { processedAt: new Date() },
        });
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const notification = await this.prisma.paymentNotification.findUnique({
        where: { gateway_dedupKey: { gateway: gatewayName, dedupKey: result.dedupKey } },
        select: { processedAt: true },
      });
      if (!notification?.processedAt) throw error;
    }
  }

  private async applyCapturedPayment(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      orderId: string;
      gateway: PaymentGateway;
      gatewayTxnRef: string;
      gatewayTxnId: string | null;
      amountRequested: bigint;
      amountCaptured: bigint | null;
      status: PaymentStatus;
      confirmedVia: PaymentConfirmationSource | null;
      succeededAt: Date | null;
    },
    order: {
      id: string;
      orderNumber: string;
      status: OrderStatus;
      paymentMethod: PaymentMethod;
      total: bigint;
      placedAt: Date;
    },
    result: VerifiedPaymentNotification,
    notification: { id: string },
    source: PaymentConfirmationSource,
  ): Promise<void> {
    if (payment.status === PaymentStatus.SUCCEEDED) return;
    const amountCaptured = result.amountCaptured;
    if (amountCaptured === undefined || amountCaptured <= 0n) {
      throw new BadRequestException('Captured payment must include a positive amount');
    }

    const succeededAt = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        amountCaptured,
        gatewayTxnId: result.gatewayTxnId ?? payment.gatewayTxnId,
        confirmedVia: source,
        succeededAt,
      },
    });

    if (amountCaptured !== order.total) {
      await this.requestRefundAndFlag(tx, order.id, payment.id, amountCaptured, RefundReason.AMOUNT_MISMATCH);
      await createOutboxEvent(tx, 'payments.amount-mismatch', order.id, {
        orderId: order.id,
        paymentId: payment.id,
      });
      return;
    }

    const reservationExpiresAt = new Date(order.placedAt.getTime() + RESERVATION_TTL_MS);
    if (
      order.status !== OrderStatus.PENDING_PAYMENT ||
      order.paymentMethod !== PaymentMethod.ONLINE ||
      succeededAt >= reservationExpiresAt
    ) {
      if (order.status === OrderStatus.PENDING_PAYMENT && succeededAt >= reservationExpiresAt) {
        await this.cancelExpiredOrder(tx, order.id, order.orderNumber);
        await createOutboxEvent(tx, 'ordering.order-expired', order.id, {
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
      }
      await this.requestRefundAndFlag(tx, order.id, payment.id, amountCaptured, RefundReason.UNEXPECTED_PAYMENT);
      await createOutboxEvent(tx, 'ordering.unexpected-payment-received', order.id, {
        orderId: order.id,
        paymentId: payment.id,
      });
      return;
    }

    const applied = await this.convertReservationAndPlaceOrder(tx, order.id, order.orderNumber);
    if (!applied) {
      await this.cancelExpiredOrder(tx, order.id, order.orderNumber);
      await this.requestRefundAndFlag(tx, order.id, payment.id, amountCaptured, RefundReason.UNEXPECTED_PAYMENT);
      await createOutboxEvent(tx, 'ordering.unexpected-payment-received', order.id, {
        orderId: order.id,
        paymentId: payment.id,
      });
      return;
    }

    await createOutboxEvent(tx, 'ordering.order-paid', order.id, {
      orderId: order.id,
      paymentId: payment.id,
      orderNumber: order.orderNumber,
    });
    await tx.paymentNotification.update({
      where: { id: notification.id },
      data: { processedAt: succeededAt },
    });
  }

  private async convertReservationAndPlaceOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    orderNumber: string,
  ): Promise<boolean> {
    const [items, reservations] = await Promise.all([
      tx.orderItem.findMany({
        where: { orderId },
        select: { variantId: true, quantity: true },
        orderBy: { variantId: 'asc' },
      }),
      tx.inventoryReservation.findMany({
        where: { orderId },
        orderBy: { variantId: 'asc' },
      }),
    ]);
    const variantIds = items.map((item) => item.variantId);
    await lockInventory(tx, variantIds);
    const inventoryRows = await tx.inventory.findMany({ where: { variantId: { in: variantIds } } });
    const inventories = new Map(inventoryRows.map((inventory) => [inventory.variantId, inventory]));
    const reservationByVariant = new Map(reservations.map((reservation) => [reservation.variantId, reservation]));
    const now = new Date();
    const conversions = items.map((item) => {
      const inventory = inventories.get(item.variantId);
      const reservation = reservationByVariant.get(item.variantId);
      const reserved = reservation?.status === InventoryReservationStatus.ACTIVE && reservation.expiresAt > now;
      const available = inventory ? inventory.quantity - inventory.reservedQuantity : 0;
      const canUseReservation = Boolean(
        inventory &&
        (reserved
          ? inventory.quantity >= item.quantity && inventory.reservedQuantity >= item.quantity
          : available >= item.quantity),
      );
      return { item, inventory, reservation, reserved, canUseReservation };
    });
    if (conversions.some((conversion) => !conversion.canUseReservation)) return false;

    for (const conversion of conversions) {
      const { item, inventory, reservation, reserved } = conversion;
      if (!inventory) throw new ConflictException('Inventory disappeared during payment settlement');
      const updated = await tx.inventory.updateMany({
        where: {
          variantId: item.variantId,
          quantity: { gte: item.quantity },
          ...(reserved ? { reservedQuantity: { gte: item.quantity } } : {}),
        },
        data: {
          quantity: { decrement: item.quantity },
          ...(reserved ? { reservedQuantity: { decrement: item.quantity } } : {}),
        },
      });
      if (updated.count !== 1) throw new ConflictException('Inventory changed during payment settlement');
      await tx.inventoryMovement.create({
        data: {
          variantId: item.variantId,
          actorUserId: null,
          reason: `Thanh toán online thành công: ${orderNumber}`,
          quantityDelta: -item.quantity,
          beforeQuantity: inventory.quantity,
          afterQuantity: inventory.quantity - item.quantity,
          beforeReserved: inventory.reservedQuantity,
          afterReserved: inventory.reservedQuantity - (reserved ? item.quantity : 0),
        },
      });
      if (reservation?.status === InventoryReservationStatus.ACTIVE) {
        await tx.inventoryReservation.update({
          where: { id: reservation.id },
          data: { status: InventoryReservationStatus.CONVERTED, resolvedAt: now },
        });
      }
    }

    await tx.awaitingDispatchItem.createMany({
      data: items.map((item) => ({ orderId, variantId: item.variantId, quantity: item.quantity })),
    });
    await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.PLACED } });
    return true;
  }

  private async requestRefundAndFlag(
    tx: Prisma.TransactionClient,
    orderId: string,
    paymentId: string,
    amount: bigint,
    reason: RefundReason,
  ): Promise<void> {
    if (amount > 0n) {
      const existing = await tx.refund.findUnique({
        where: { paymentId_reason: { paymentId, reason } },
      });
      if (!existing) {
        const totalRequested = await tx.refund.aggregate({
          where: {
            paymentId,
            status: { in: [RefundStatus.REQUESTED, RefundStatus.REFUNDED] },
          },
          _sum: { amount: true },
        });
        const captured = await tx.payment.findUnique({
          where: { id: paymentId },
          select: { amountCaptured: true },
        });
        const alreadyRefunded = totalRequested._sum.amount ?? 0n;
        if (!captured?.amountCaptured || alreadyRefunded + amount > captured.amountCaptured) {
          throw new ConflictException('Refund requests cannot exceed the captured payment amount');
        }
        await tx.refund.create({
          data: { orderId, paymentId, reason, amount, status: RefundStatus.REQUESTED },
        });
      }
    }

    const flagType =
      reason === RefundReason.AMOUNT_MISMATCH ? OrderFlagType.AMOUNT_MISMATCH : OrderFlagType.UNEXPECTED_PAYMENT;
    await tx.orderFlag.upsert({
      where: { orderId_type: { orderId, type: flagType } },
      create: { orderId, type: flagType, details: asJson({ paymentId, amount: amount.toString() }) },
      update: { details: asJson({ paymentId, amount: amount.toString() }), resolvedAt: null },
    });
  }

  private async cancelExpiredOrder(tx: Prisma.TransactionClient, orderId: string, orderNumber: string): Promise<void> {
    await this.releaseReservationsAndVoucher(tx, orderId, orderNumber);
    await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING_PAYMENT },
      data: { status: OrderStatus.CANCELLED },
    });
    await tx.payment.updateMany({
      where: { orderId, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.EXPIRED },
    });
  }

  private async releaseReservationsAndVoucher(
    tx: Prisma.TransactionClient,
    orderId: string,
    orderNumber: string,
  ): Promise<void> {
    const reservations = await tx.inventoryReservation.findMany({
      where: { orderId, status: InventoryReservationStatus.ACTIVE },
      orderBy: { variantId: 'asc' },
    });
    await lockInventory(
      tx,
      reservations.map((reservation) => reservation.variantId),
    );
    const inventoryRows = await tx.inventory.findMany({
      where: { variantId: { in: reservations.map((reservation) => reservation.variantId) } },
    });
    const inventoryByVariant = new Map(inventoryRows.map((inventory) => [inventory.variantId, inventory]));

    for (const reservation of reservations) {
      const inventory = inventoryByVariant.get(reservation.variantId);
      if (!inventory || inventory.reservedQuantity < reservation.quantity) {
        throw new ConflictException('Inventory reservation counters are inconsistent');
      }
      const updated = await tx.inventory.updateMany({
        where: { variantId: reservation.variantId, reservedQuantity: { gte: reservation.quantity } },
        data: { reservedQuantity: { decrement: reservation.quantity } },
      });
      if (updated.count !== 1) throw new ConflictException('Inventory reservation changed during release');
      await tx.inventoryMovement.create({
        data: {
          variantId: reservation.variantId,
          actorUserId: null,
          reason: `Giải phóng giữ hàng đơn ${orderNumber}`,
          quantityDelta: 0,
          beforeQuantity: inventory.quantity,
          afterQuantity: inventory.quantity,
          beforeReserved: inventory.reservedQuantity,
          afterReserved: inventory.reservedQuantity - reservation.quantity,
        },
      });
      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: {
          status:
            reservation.expiresAt <= new Date()
              ? InventoryReservationStatus.EXPIRED
              : InventoryReservationStatus.RELEASED,
          resolvedAt: new Date(),
        },
      });
    }

    const voucherUsages = await tx.voucherUsage.findMany({
      where: { orderId, releasedAt: null },
      select: { id: true, voucherId: true },
    });
    for (const usage of voucherUsages) {
      const released = await tx.voucherUsage.updateMany({
        where: { id: usage.id, releasedAt: null },
        data: { releasedAt: new Date() },
      });
      if (released.count === 1) {
        const updated = await tx.voucher.updateMany({
          where: { id: usage.voucherId, usedCount: { gte: 1 } },
          data: { usedCount: { decrement: 1 } },
        });
        if (updated.count !== 1) throw new ConflictException('Voucher usage counter is inconsistent');
      }
    }
  }

  private async expireOrder(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderNumber: true, status: true, placedAt: true },
      });
      if (!order || order.status !== OrderStatus.PENDING_PAYMENT) return;
      if (Date.now() < order.placedAt.getTime() + RESERVATION_TTL_MS) return;

      await this.cancelExpiredOrder(tx, order.id, order.orderNumber);
      await createOutboxEvent(tx, 'ordering.order-expired', order.id, {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    });
  }

  private getGateway(name: PaymentGateway): PaymentGatewayContract {
    const gateway = this.gateways.get(name);
    if (!gateway) throw new ServiceUnavailableException(`Payment gateway is not configured: ${name}`);
    return gateway;
  }
}

async function lockOrder(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
}

async function lockPayment(tx: Prisma.TransactionClient, paymentId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE`;
}

async function lockInventory(tx: Prisma.TransactionClient, variantIds: string[]): Promise<void> {
  const ids = [...new Set(variantIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw`
    SELECT variant_id FROM inventory
    WHERE variant_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY variant_id FOR UPDATE
  `;
}

async function createOutboxEvent(
  tx: Prisma.TransactionClient,
  type: string,
  orderId: string,
  payload: Record<string, string>,
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      type,
      aggregateType: 'Order',
      aggregateId: orderId,
      payload: asJson(payload),
    },
  });
}

function replayAttempt(
  storedHash: string,
  requestHash: string,
  response: Prisma.JsonValue | null,
): PaymentAttemptReservation {
  if (storedHash !== requestHash) {
    throw new ConflictException('Idempotency-Key was already used with a different request body');
  }
  const paymentId = readPaymentId(response);
  if (!paymentId) throw new ConflictException('A request with this Idempotency-Key is still processing');
  return { paymentId, response };
}

function readPaymentId(value: Prisma.JsonValue | null): string | undefined {
  if (!value || Array.isArray(value) || typeof value !== 'object') return undefined;
  const paymentId = value.paymentId;
  return typeof paymentId === 'string' ? paymentId : undefined;
}

function readPaymentLinkResponse(value: Prisma.JsonValue): PaymentLinkResponseDto | undefined {
  if (!value || Array.isArray(value) || typeof value !== 'object') return undefined;
  const { paymentId, gateway, paymentUrl, expiresAt } = value;
  if (
    typeof paymentId !== 'string' ||
    (gateway !== PaymentGateway.VNPAY && gateway !== PaymentGateway.MOMO) ||
    typeof paymentUrl !== 'string' ||
    typeof expiresAt !== 'string'
  ) {
    return undefined;
  }
  return { paymentId, gateway, paymentUrl, expiresAt: new Date(expiresAt) };
}

function paymentResponse(payment: {
  id: string;
  gateway: PaymentGateway;
  paymentUrl: string | null;
  paymentUrlExpiresAt: Date;
}): PaymentLinkResponseDto {
  if (!payment.paymentUrl) throw new ConflictException('Payment link is not available yet');
  return {
    paymentId: payment.id,
    gateway: payment.gateway,
    paymentUrl: payment.paymentUrl,
    expiresAt: payment.paymentUrlExpiresAt,
  };
}

function normalizeIdempotencyKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key) throw new BadRequestException('Idempotency-Key header is required');
  if (key.length > 255) throw new BadRequestException('Idempotency-Key must be at most 255 characters');
  return key;
}

function normalizeClientIp(value: string): string {
  const ip = value.trim() || '127.0.0.1';
  return ip.length > 45 ? ip.slice(0, 45) : ip;
}

function requiredUrl(config: ConfigService, name: string): string {
  const value = config.get<string>(name)?.trim();
  if (!value) throw new ServiceUnavailableException(`Payment gateway configuration is missing: ${name}`);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('Unsupported protocol');
    return url.toString();
  } catch {
    throw new ServiceUnavailableException(`${name} must be an absolute URL`);
  }
}

function optionalUrl(value: string | undefined): string | undefined {
  const url = value?.trim();
  if (!url) return undefined;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      throw new Error('Unsupported protocol');
    }
    return parsedUrl.toString();
  } catch {
    throw new ServiceUnavailableException('FRONTEND_URL must be an absolute URL');
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
