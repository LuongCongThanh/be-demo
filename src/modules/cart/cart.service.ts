import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import type { Prisma } from '#src/generated/prisma/client.js';
import { findActiveSalePrices } from '#src/modules/catalog/pricing/domain/active-sale-prices.js';
import { AddCartItemDto } from '#src/modules/cart/dto/cart.dto.js';

const CART_TTL_MS = 30 * 24 * 60 * 60_000;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getGuestCart(sessionId?: string) {
    if (!sessionId) {
      return this.createGuestCart();
    }
    let cart = await this.prisma.cart.findFirst({
      where: { sessionId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: { items: { include: { variant: { include: { product: true, inventory: true } } } } },
    });
    if (!cart) cart = await this.createGuestCart(sessionId);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { expiresAt: new Date(Date.now() + CART_TTL_MS) } });
    return this.serializeCart(cart);
  }

  async getCustomerCart(userId: string) {
    let cart = await this.prisma.cart.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { items: { include: { variant: { include: { product: true, inventory: true } } } } },
    });
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: { items: { include: { variant: { include: { product: true, inventory: true } } } } },
      });
    }
    return this.serializeCart(cart);
  }

  async addGuestItem(sessionId: string | undefined, dto: AddCartItemDto) {
    const cart = await this.ensureGuestCart(sessionId);
    return this.addItem(cart.id, dto);
  }

  async updateGuestItem(sessionId: string | undefined, itemId: string, quantity: number) {
    const cart = await this.ensureGuestCart(sessionId);
    return this.updateItem(cart.id, itemId, quantity);
  }

  async deleteGuestItem(sessionId: string | undefined, itemId: string) {
    const cart = await this.ensureGuestCart(sessionId);
    const result = await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    if (result.count === 0) throw new NotFoundException('Cart item not found');
    return this.serializeCartId(cart.id);
  }

  async addCustomerItem(userId: string, dto: AddCartItemDto) {
    const cart = await this.ensureCustomerCart(userId);
    return this.addItem(cart.id, dto);
  }

  async updateCustomerItem(userId: string, itemId: string, quantity: number) {
    const cart = await this.ensureCustomerCart(userId);
    return this.updateItem(cart.id, itemId, quantity);
  }

  async deleteCustomerItem(userId: string, itemId: string) {
    const cart = await this.ensureCustomerCart(userId);
    const result = await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    if (result.count === 0) throw new NotFoundException('Cart item not found');
    return this.serializeCartId(cart.id);
  }

  async mergeGuestCart(userId: string, sessionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const guest = await tx.cart.findFirst({
        where: { sessionId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
        include: { items: true },
      });
      if (!guest) throw new NotFoundException('Guest cart not found');

      let customer = await tx.cart.findFirst({ where: { userId, status: 'ACTIVE' }, include: { items: true } });
      if (!customer) {
        customer = await tx.cart.create({ data: { userId }, include: { items: true } });
      }

      const warnings: Array<Record<string, unknown>> = [];
      for (const guestItem of guest.items) {
        const [variant, customerItem] = await Promise.all([
          tx.productVariant.findUnique({ where: { id: guestItem.variantId }, include: { inventory: true } }),
          tx.cartItem.findUnique({
            where: { cartId_variantId: { cartId: customer.id, variantId: guestItem.variantId } },
          }),
        ]);
        if (!variant || variant.status !== 'ACTIVE') {
          warnings.push({ variantId: guestItem.variantId, reason: 'Variant unavailable', quantity: 0 });
          continue;
        }
        const available = Math.max(0, (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0));
        const total = (customerItem?.quantity ?? 0) + guestItem.quantity;
        const quantity = Math.min(total, available, 10);
        if (quantity < total) {
          warnings.push({ variantId: guestItem.variantId, reason: 'Quantity capped', quantity });
        }
        if (quantity === 0) continue;
        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: customer.id, variantId: guestItem.variantId } },
          update: { quantity },
          create: {
            cartId: customer.id,
            variantId: guestItem.variantId,
            quantity,
            priceSnapshot: variant.price,
          },
        });
      }
      await tx.cart.update({ where: { id: guest.id }, data: { status: 'MERGED', expiresAt: new Date() } });
      return { ...(await this.serializeCartIdIn(tx, customer.id)), warnings };
    });
  }

  private async createGuestCart(sessionId: string = randomUUID()) {
    const cart = await this.prisma.cart.create({
      data: { sessionId, expiresAt: new Date(Date.now() + CART_TTL_MS) },
      include: { items: { include: { variant: { include: { product: true, inventory: true } } } } },
    });
    return cart;
  }

  private async ensureGuestCart(sessionId?: string) {
    if (!sessionId) return this.createGuestCart();
    const cart = await this.prisma.cart.findFirst({
      where: { sessionId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    });
    if (cart) return cart;
    return this.createGuestCart(sessionId);
  }

  private async ensureCustomerCart(userId: string) {
    const cart = await this.prisma.cart.findFirst({ where: { userId, status: 'ACTIVE' } });
    if (cart) return cart;
    return this.prisma.cart.create({ data: { userId } });
  }

  private async addItem(cartId: string, dto: AddCartItemDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { inventory: true },
    });
    if (!variant || variant.status !== 'ACTIVE') throw new NotFoundException('Active variant not found');
    const available = Math.max(0, (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0));
    if (available <= 0) throw new ConflictException('Variant is out of stock');

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId: dto.variantId } },
    });
    const total = (existing?.quantity ?? 0) + dto.quantity;
    if (total > available || total > 10) {
      throw new ConflictException(`Cart quantity is capped at ${Math.min(available, 10)}`);
    }

    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId: dto.variantId } },
      update: { quantity: total },
      create: {
        cartId,
        variantId: dto.variantId,
        quantity: dto.quantity,
        priceSnapshot: variant.price,
      },
    });
    return this.serializeCartId(cartId);
  }

  private async updateItem(cartId: string, itemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId },
      include: { variant: { include: { inventory: true } } },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    const available = Math.max(
      0,
      (item.variant.inventory?.quantity ?? 0) - (item.variant.inventory?.reservedQuantity ?? 0),
    );
    if (available <= 0) throw new ConflictException('Variant is out of stock');
    if (quantity > available || quantity > 10) {
      throw new ConflictException(`Cart quantity is capped at ${Math.min(available, 10)}`);
    }
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.serializeCartId(cartId);
  }

  private async serializeCartId(cartId: string) {
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: { items: { include: { variant: { include: { product: true, inventory: true } } } } },
    });
    return this.serializeCart(cart);
  }

  private async serializeCartIdIn(tx: Prisma.TransactionClient, cartId: string) {
    const cart = await tx.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: { items: { include: { variant: { include: { product: true, inventory: true } } } } },
    });
    return this.serializeCart(cart);
  }

  private async serializeCart(cart: any) {
    const variantIds = cart.items.map((item: any) => item.variantId);
    const activePrices = await findActiveSalePrices(this.prisma, variantIds, new Date());
    const items = cart.items.map((item: any) => {
      const regularPrice = Number(item.variant.price);
      const sale = activePrices.get(item.variantId);
      const unitPrice = sale?.price ?? regularPrice;
      const snapshot = item.priceSnapshot === null ? null : Number(item.priceSnapshot);
      return {
        id: item.id,
        variantId: item.variantId,
        sku: item.variant.sku,
        productName: item.variant.product.name,
        quantity: item.quantity,
        regularPrice,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        priceChanged: snapshot !== null && snapshot !== unitPrice,
      };
    });
    return {
      id: cart.id,
      sessionId: cart.sessionId ?? null,
      status: cart.status,
      expiresAt: cart.expiresAt,
      items,
      subtotal: items.reduce((sum: number, item: any) => sum + item.lineTotal, 0),
    };
  }
}
