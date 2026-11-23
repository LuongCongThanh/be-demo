import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { AdjustInventoryDto, CreateStockCountDto } from '#src/modules/inventory/dto/inventory.dto.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(variantId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { variantId },
      include: { variant: { select: { id: true, sku: true, status: true } } },
    });
    if (!inventory) throw new NotFoundException('Inventory not found');
    return this.availability(inventory);
  }

  async adjust(variantId: string, actorUserId: string, dto: AdjustInventoryDto) {
    if (!Number.isInteger(dto.delta) || dto.delta === 0) {
      throw new ConflictException('Delta must be a non-zero integer');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM inventory WHERE variant_id = ${variantId}::uuid FOR UPDATE`;
      const inventory = await tx.inventory.findUnique({ where: { variantId } });
      if (!inventory) throw new NotFoundException('Inventory not found');
      const available = inventory.quantity - inventory.reservedQuantity;
      if (dto.delta < 0 && Math.abs(dto.delta) > available) {
        throw new ConflictException(`Maximum decrease is ${available}`);
      }
      const afterQuantity = inventory.quantity + dto.delta;
      if (afterQuantity < 0) throw new ConflictException('Inventory cannot become negative');

      await tx.inventory.update({ where: { variantId }, data: { quantity: afterQuantity } });
      await tx.inventoryMovement.create({
        data: {
          variantId,
          actorUserId,
          reason: dto.reason,
          quantityDelta: dto.delta,
          beforeQuantity: inventory.quantity,
          afterQuantity,
          beforeReserved: inventory.reservedQuantity,
          afterReserved: inventory.reservedQuantity,
        },
      });
      return this.availability({ ...inventory, quantity: afterQuantity });
    });
  }

  async createCount(variantId: string, actorUserId: string, dto: CreateStockCountDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM inventory WHERE variant_id = ${variantId}::uuid FOR UPDATE`;
      const inventory = await tx.inventory.findUnique({ where: { variantId } });
      if (!inventory) throw new NotFoundException('Inventory not found');
      const awaiting = await tx.awaitingDispatchItem.aggregate({
        where: { variantId },
        _sum: { quantity: true },
      });
      const awaitingQuantity = awaiting._sum.quantity ?? 0;
      return tx.inventoryStockCount.create({
        data: {
          variantId,
          actorUserId,
          physicalCount: dto.physicalCount,
          onShelfAtCount: inventory.quantity,
          awaitingAtCount: awaitingQuantity,
          discrepancy: dto.physicalCount - inventory.quantity - awaitingQuantity,
        },
      });
    });
  }

  async confirmCount(countId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.inventoryStockCount.findUnique({ where: { id: countId } });
      if (!count) throw new NotFoundException('Stock count not found');
      if (count.confirmedAt) return count;

      await tx.$queryRaw`SELECT id FROM inventory WHERE variant_id = ${count.variantId}::uuid FOR UPDATE`;
      const inventory = await tx.inventory.findUnique({ where: { variantId: count.variantId } });
      if (!inventory) throw new NotFoundException('Inventory not found');
      const awaiting = await tx.awaitingDispatchItem.aggregate({
        where: { variantId: count.variantId },
        _sum: { quantity: true },
      });
      const expectedQuantity = inventory.quantity + (awaiting._sum.quantity ?? 0);
      const delta = count.physicalCount - expectedQuantity;
      const available = inventory.quantity - inventory.reservedQuantity;
      if (delta < 0 && Math.abs(delta) > available) {
        throw new ConflictException(`Maximum decrease is ${available}`);
      }
      if (inventory.quantity + delta < 0)
        throw new ConflictException('Confirmed count cannot create negative inventory');

      await tx.inventory.update({
        where: { variantId: count.variantId },
        data: { quantity: inventory.quantity + delta },
      });
      await tx.inventoryMovement.create({
        data: {
          variantId: count.variantId,
          actorUserId,
          reason: `Stock count confirmation ${count.id}`,
          quantityDelta: delta,
          beforeQuantity: inventory.quantity,
          afterQuantity: inventory.quantity + delta,
          beforeReserved: inventory.reservedQuantity,
          afterReserved: inventory.reservedQuantity,
        },
      });
      return tx.inventoryStockCount.update({
        where: { id: countId },
        data: {
          onShelfAtCount: inventory.quantity,
          awaitingAtCount: awaiting._sum.quantity ?? 0,
          discrepancy: delta,
          confirmedAt: new Date(),
        },
      });
    });
  }

  private availability(inventory: { quantity: number; reservedQuantity: number }) {
    return {
      onShelfQuantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      availableQuantity: inventory.quantity - inventory.reservedQuantity,
      maximumDecrease: Math.max(0, inventory.quantity - inventory.reservedQuantity),
    };
  }
}
