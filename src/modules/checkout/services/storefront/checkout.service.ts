import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma, type Voucher } from '#src/generated/prisma/client.js';
import { OrderStatus, PaymentMethod } from '#src/generated/prisma/enums.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import {
  calculateShippingFee,
  calculateVoucherDiscount,
  CHECKOUT_QUOTE_TTL_MS,
  DEFAULT_COD_LIMIT,
  DEFAULT_SHIPPING_FEE,
  distributeDiscount,
  fingerprint,
} from '#src/modules/checkout/domain/checkout-pricing.js';
import type { CreateCheckoutQuoteDto } from '#src/modules/checkout/dto/storefront/create-checkout-quote.dto.js';
import type { CheckoutQuoteResponseDto } from '#src/modules/checkout/dto/storefront/checkout-quote-response.dto.js';
import type { PlacedOrderResponseDto } from '#src/modules/checkout/dto/storefront/placed-order-response.dto.js';
import type { PlaceCodOrderDto } from '#src/modules/checkout/dto/storefront/place-cod-order.dto.js';

const IDEMPOTENCY_SCOPE = 'checkout.place-order';
const ORDER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface CheckoutInput {
  items: { variantId: string; quantity: number }[];
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  shippingProvinceCode: string;
  shippingWardCode: string;
  shippingAddress: string;
  voucherCode?: string;
}

interface CheckoutLine {
  variantId: string;
  productName: string;
  sku: string;
  sizeName: string;
  colorName: string;
  quantity: number;
  listPrice: number;
  unitPrice: number;
  lineTotal: number;
  availableQuantity: number;
  reservedQuantity: number;
  weightGrams: number;
}

interface VoucherSnapshot {
  id: string;
  code: string;
  type: Voucher['type'];
  value: number;
  maxDiscount: number | null;
  minSubtotal: number;
  totalLimit: number | null;
  perBuyerLimit: number | null;
  usedCount: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
}

interface CheckoutCalculation {
  lines: CheckoutLine[];
  voucher: VoucherSnapshot | null;
  subtotal: number;
  discount: number;
  shippingFee: number;
  shippingFeeFallback: true;
  total: number;
  totalWeightGrams: number;
  fingerprint: string;
}

type CheckoutDb = Pick<Prisma.TransactionClient, 'productVariant' | 'salePrice' | 'voucher' | 'voucherUsage'>;

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async quote(dto: CreateCheckoutQuoteDto, userId?: string): Promise<CheckoutQuoteResponseDto> {
    const input = normalizeInput(dto);
    const now = new Date();
    const calculation = await calculateCheckout(this.prisma, input, userId, now);
    if (calculation.total <= 0) throw new BadRequestException('Order total must be greater than zero');

    const expiresAt = new Date(now.getTime() + CHECKOUT_QUOTE_TTL_MS);
    const quote = await this.prisma.checkoutQuote.create({
      data: {
        userId: userId ?? null,
        input: asJson(input),
        lines: asJson(calculation.lines),
        subtotal: BigInt(calculation.subtotal),
        discount: BigInt(calculation.discount),
        shippingFee: BigInt(calculation.shippingFee),
        total: BigInt(calculation.total),
        fingerprint: calculation.fingerprint,
        expiresAt,
      },
    });

    return toQuoteResponse(quote.id, calculation, expiresAt, input.voucherCode);
  }

  async placeCod(
    dto: PlaceCodOrderDto,
    idempotencyKey: string | undefined,
    userId?: string,
  ): Promise<PlacedOrderResponseDto> {
    const key = normalizeIdempotencyKey(idempotencyKey);
    const requestHash = fingerprint({ body: dto, userId: userId ?? null });
    const previous = await this.prisma.idempotencyKey.findFirst({
      where: { scope: IDEMPOTENCY_SCOPE, key },
    });
    if (previous) return this.replay(previous.requestHash, requestHash, previous.response);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.idempotencyKey.create({
          data: { scope: IDEMPOTENCY_SCOPE, key, requestHash },
        });

        const quoteLocks = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM checkout_quotes WHERE id = ${dto.quoteId}::uuid FOR UPDATE
        `;
        if (quoteLocks.length === 0) throw new NotFoundException('Checkout quote not found');

        const quote = await tx.checkoutQuote.findUnique({ where: { id: dto.quoteId } });
        if (!quote) throw new NotFoundException('Checkout quote not found');
        if (quote.userId !== (userId ?? null)) {
          throw new ForbiddenException('Checkout quote belongs to a different buyer');
        }
        if (quote.expiresAt <= new Date()) {
          throw new ConflictException('Checkout quote expired; request a new quote');
        }

        const input = quote.input as unknown as CheckoutInput;
        const variantIds = input.items.map(({ variantId }) => variantId).sort();
        await lockRows(tx, 'product_variants', variantIds);
        await lockRows(tx, 'inventory', variantIds, 'variant_id');
        if (input.voucherCode) await lockVoucher(tx, input.voucherCode);

        const calculation = await calculateCheckout(tx, input, userId, new Date(), true);
        if (calculation.fingerprint !== quote.fingerprint) {
          throw new ConflictException('Price, stock, voucher, or shipping changed; request a new quote');
        }
        if (calculation.total <= 0) throw new ConflictException('Order total must be greater than zero');
        if (calculation.total > DEFAULT_COD_LIMIT) {
          throw new ConflictException(`COD is unavailable above ${DEFAULT_COD_LIMIT} VND`);
        }

        for (const line of calculation.lines) {
          const updated = await tx.inventory.updateMany({
            where: {
              variantId: line.variantId,
              quantity: { gte: line.quantity + line.reservedQuantity },
            },
            data: { quantity: { decrement: line.quantity } },
          });
          if (updated.count !== 1) throw new ConflictException(`Insufficient stock for variant ${line.variantId}`);
        }

        const order = await tx.order.create({
          data: {
            orderNumber: newOrderNumber(),
            quoteId: quote.id,
            userId: quote.userId,
            status: OrderStatus.PLACED,
            paymentMethod: PaymentMethod.COD,
            contactName: input.contactName,
            contactPhone: input.contactPhone,
            contactEmail: input.contactEmail ?? null,
            shippingProvinceCode: input.shippingProvinceCode,
            shippingWardCode: input.shippingWardCode,
            shippingAddress: input.shippingAddress,
            subtotal: BigInt(calculation.subtotal),
            discountAmount: BigInt(calculation.discount),
            shippingFee: BigInt(calculation.shippingFee),
            shippingFeeFallback: calculation.shippingFeeFallback,
            total: BigInt(calculation.total),
            totalWeightGrams: calculation.totalWeightGrams,
            items: {
              create: buildOrderItems(calculation.lines, calculation.discount),
            },
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentMethod: true,
            subtotal: true,
            discountAmount: true,
            shippingFee: true,
            total: true,
            placedAt: true,
          },
        });
        await tx.awaitingDispatchItem.createMany({
          data: calculation.lines.map((line) => ({
            orderId: order.id,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        });

        if (calculation.voucher) {
          await tx.voucher.update({
            where: { id: calculation.voucher.id },
            data: { usedCount: { increment: 1 } },
          });
          await tx.voucherUsage.create({
            data: {
              voucherId: calculation.voucher.id,
              orderId: order.id,
              userId: quote.userId,
              phone: input.contactPhone,
              discount: BigInt(calculation.discount),
            },
          });
        }

        const response = toOrderResponse(order);
        await tx.idempotencyKey.update({
          where: { scope_key: { scope: IDEMPOTENCY_SCOPE, key } },
          data: { responseStatus: 201, response: asJson(response) },
        });
        return response;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const idempotencyRecord = await this.prisma.idempotencyKey.findFirst({
          where: { scope: IDEMPOTENCY_SCOPE, key },
        });
        if (idempotencyRecord)
          return this.replay(idempotencyRecord.requestHash, requestHash, idempotencyRecord.response);
        const existingOrder = await this.prisma.order.findUnique({
          where: { quoteId: dto.quoteId },
          select: { id: true },
        });
        if (existingOrder) throw new ConflictException('Checkout quote has already been used');
      }
      throw error;
    }
  }

  private replay(storedHash: string, requestHash: string, response: Prisma.JsonValue | null): PlacedOrderResponseDto {
    if (storedHash !== requestHash) {
      throw new ConflictException('Idempotency-Key was already used with a different request body');
    }
    if (!response) throw new ConflictException('A request with this Idempotency-Key is still processing');
    return response as unknown as PlacedOrderResponseDto;
  }
}

async function calculateCheckout(
  db: CheckoutDb,
  input: CheckoutInput,
  userId: string | undefined,
  now: Date,
  isPlacement = false,
): Promise<CheckoutCalculation> {
  const ids = input.items.map(({ variantId }) => variantId);
  const variants = await db.productVariant.findMany({
    where: { id: { in: ids }, status: 'ACTIVE', product: { status: 'ACTIVE' } },
    include: {
      product: { select: { name: true, weightGrams: true } },
      size: { select: { name: true } },
      color: { select: { name: true } },
      inventory: { select: { quantity: true, reservedQuantity: true } },
    },
  });
  if (variants.length !== ids.length) {
    const exception = isPlacement ? ConflictException : NotFoundException;
    throw new exception('One or more variants are unavailable; request a new quote');
  }

  const activeSales = await db.salePrice.findMany({
    where: { variantId: { in: ids }, startsAt: { lte: now }, endsAt: { gt: now } },
    select: { variantId: true, price: true },
  });
  const salesByVariant = new Map(activeSales.map((sale) => [sale.variantId, safeAmount(sale.price)]));
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
  const lines: CheckoutLine[] = input.items.map(({ variantId, quantity }) => {
    const variant = variantsById.get(variantId);
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);
    const reservedQuantity = variant.inventory?.reservedQuantity ?? 0;
    const availableQuantity = Math.max(0, (variant.inventory?.quantity ?? 0) - reservedQuantity);
    if (availableQuantity < quantity) {
      const exception = isPlacement ? ConflictException : BadRequestException;
      throw new exception(`Variant ${variantId} has ${availableQuantity} available; ${quantity} requested`);
    }
    const listPrice = safeAmount(variant.price);
    const unitPrice = salesByVariant.get(variantId) ?? listPrice;
    return {
      variantId,
      productName: variant.product.name,
      sku: variant.sku,
      sizeName: variant.size.name,
      colorName: variant.color.name,
      quantity,
      listPrice,
      unitPrice,
      lineTotal: safeAmount(BigInt(unitPrice) * BigInt(quantity)),
      availableQuantity,
      reservedQuantity,
      weightGrams: variant.product.weightGrams,
    };
  });

  const subtotal = safeAmount(lines.reduce((sum, line) => sum + BigInt(line.lineTotal), 0n));
  const voucher = await findVoucher(db, input, userId, subtotal, now, isPlacement);
  const discount = calculateVoucherDiscount(subtotal, voucher);
  const shippingFee = calculateShippingFee(subtotal, discount, DEFAULT_SHIPPING_FEE);
  const total = safeAmount(BigInt(subtotal) - BigInt(discount) + BigInt(shippingFee));
  const totalWeightGrams = lines.reduce((sum, line) => sum + line.weightGrams * line.quantity, 0);
  if (totalWeightGrams > 2_147_483_647) {
    throw new BadRequestException('Total shipment weight exceeds the supported range');
  }
  const comparison = {
    input,
    lines,
    voucher,
    subtotal,
    discount,
    shippingFee,
    shippingFeeFallback: true,
    total,
    totalWeightGrams,
  };

  return {
    lines,
    voucher,
    subtotal,
    discount,
    shippingFee,
    shippingFeeFallback: true,
    total,
    totalWeightGrams,
    fingerprint: fingerprint(comparison),
  };
}

async function findVoucher(
  db: CheckoutDb,
  input: CheckoutInput,
  userId: string | undefined,
  subtotal: number,
  now: Date,
  isPlacement: boolean,
): Promise<VoucherSnapshot | null> {
  if (!input.voucherCode) return null;
  const voucher = await db.voucher.findUnique({ where: { code: input.voucherCode } });
  if (
    !voucher ||
    !voucher.isActive ||
    voucher.startsAt > now ||
    voucher.endsAt <= now ||
    subtotal < Number(voucher.minSubtotal) ||
    (voucher.totalLimit !== null && voucher.usedCount >= voucher.totalLimit)
  ) {
    const exception = isPlacement ? ConflictException : BadRequestException;
    throw new exception(`Voucher "${input.voucherCode}" is unavailable or does not meet its conditions`);
  }

  if (voucher.perBuyerLimit !== null) {
    const usageCount = await db.voucherUsage.count({
      where: {
        voucherId: voucher.id,
        OR: [{ phone: input.contactPhone }, ...(userId ? [{ userId }] : [])],
      },
    });
    if (usageCount >= voucher.perBuyerLimit) {
      const exception = isPlacement ? ConflictException : BadRequestException;
      throw new exception(`Voucher "${input.voucherCode}" has reached this buyer's usage limit`);
    }
  }

  return {
    id: voucher.id,
    code: voucher.code,
    type: voucher.type,
    value: safeAmount(voucher.value),
    maxDiscount: voucher.maxDiscount === null ? null : safeAmount(voucher.maxDiscount),
    minSubtotal: safeAmount(voucher.minSubtotal),
    totalLimit: voucher.totalLimit,
    perBuyerLimit: voucher.perBuyerLimit,
    usedCount: voucher.usedCount,
    startsAt: voucher.startsAt,
    endsAt: voucher.endsAt,
    isActive: voucher.isActive,
  };
}

function normalizeInput(dto: CreateCheckoutQuoteDto): CheckoutInput {
  const items = dto.items
    .map(({ variantId, quantity }) => ({ variantId, quantity }))
    .sort((left, right) => left.variantId.localeCompare(right.variantId));
  if (new Set(items.map(({ variantId }) => variantId)).size !== items.length) {
    throw new BadRequestException('Each variant may appear only once in checkout');
  }

  const contactName = dto.contactName.trim();
  const contactPhone = dto.contactPhone.trim();
  const shippingProvinceCode = dto.shippingProvinceCode.trim();
  const shippingWardCode = dto.shippingWardCode.trim();
  const shippingAddress = dto.shippingAddress.trim();
  if (!contactName || !contactPhone || !shippingProvinceCode || !shippingWardCode || !shippingAddress) {
    throw new BadRequestException('Contact and delivery address fields are required');
  }

  return {
    items,
    contactName,
    contactPhone,
    ...(dto.contactEmail ? { contactEmail: dto.contactEmail.trim().toLowerCase() } : {}),
    shippingProvinceCode,
    shippingWardCode,
    shippingAddress,
    ...(dto.voucherCode ? { voucherCode: dto.voucherCode.trim().toUpperCase() } : {}),
  };
}

function toQuoteResponse(
  quoteId: string,
  calculation: CheckoutCalculation,
  expiresAt: Date,
  voucherCode?: string,
): CheckoutQuoteResponseDto {
  return {
    quoteId,
    items: calculation.lines.map(({ reservedQuantity: _reserved, weightGrams: _weight, ...line }) => line),
    subtotal: calculation.subtotal,
    discount: calculation.discount,
    shippingFee: calculation.shippingFee,
    shippingFeeFallback: calculation.shippingFeeFallback,
    total: calculation.total,
    codAllowed: calculation.total <= DEFAULT_COD_LIMIT,
    ...(voucherCode ? { voucherCode } : {}),
    expiresAt,
  };
}

function toOrderResponse(order: {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotal: bigint;
  discountAmount: bigint;
  shippingFee: bigint;
  total: bigint;
  placedAt: Date;
}): PlacedOrderResponseDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    subtotal: Number(order.subtotal),
    discount: Number(order.discountAmount),
    shippingFee: Number(order.shippingFee),
    total: Number(order.total),
    placedAt: order.placedAt,
  };
}

function buildOrderItems(lines: CheckoutLine[], discount: number) {
  const discountShares = distributeDiscount(lines, discount);
  return lines.map((line, index) => ({
    variantId: line.variantId,
    productName: line.productName,
    sku: line.sku,
    sizeName: line.sizeName,
    colorName: line.colorName,
    listPrice: BigInt(line.listPrice),
    unitPrice: BigInt(line.unitPrice),
    quantity: line.quantity,
    lineTotal: BigInt(line.lineTotal),
    voucherDiscount: BigInt(discountShares[index]),
  }));
}

function normalizeIdempotencyKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key) throw new BadRequestException('Idempotency-Key header is required');
  if (key.length > 255) throw new BadRequestException('Idempotency-Key must be at most 255 characters');
  return key;
}

function safeAmount(value: bigint): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) {
    throw new BadRequestException('Checkout amounts exceed the supported numeric range');
  }
  return amount;
}

async function lockRows(
  tx: Prisma.TransactionClient,
  table: 'product_variants' | 'inventory',
  ids: string[],
  column = 'id',
): Promise<void> {
  if (ids.length === 0) return;
  const safeColumn = column === 'variant_id' ? Prisma.raw('"variant_id"') : Prisma.raw('"id"');
  await tx.$queryRaw`
    SELECT ${safeColumn} FROM ${Prisma.raw(`"${table}"`)}
    WHERE ${safeColumn} IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY ${safeColumn} FOR UPDATE
  `;
}

async function lockVoucher(tx: Prisma.TransactionClient, code: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM vouchers WHERE code = ${code} FOR UPDATE`;
}

function newOrderNumber(now = new Date()): string {
  const month = `${String(now.getUTCFullYear()).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const suffix = Array.from({ length: 6 }, () => ORDER_CODE_ALPHABET[randomInt(ORDER_CODE_ALPHABET.length)]).join('');
  return `FS${month}-${suffix}`;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
