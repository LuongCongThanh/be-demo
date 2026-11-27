import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Prisma } from '#src/generated/prisma/client.js';
import type { PrismaTransactionHost } from '#src/infrastructure/database/cls-transaction-runner.js';
import { InventoryRepository } from '#src/modules/inventory/application/ports/inventory.repository.js';
import type {
  InventoryLevel,
  NewInventoryMovement,
  NewStockCount,
  StockCount,
  StockCountConfirmation,
  StockLine,
} from '#src/modules/inventory/domain/inventory.model.js';

@Injectable()
export class PrismaInventoryRepository extends InventoryRepository {
  constructor(@Inject(TransactionHost) private readonly txHost: PrismaTransactionHost) {
    super();
  }

  async findLevels(variantIds: string[], options?: { lockForUpdate?: boolean }): Promise<InventoryLevel[]> {
    if (variantIds.length === 0) return [];
    const { tx } = this.txHost;
    if (options?.lockForUpdate) {
      if (!this.txHost.isTransactionActive()) {
        throw new Error('lockForUpdate requires an active transaction: call it inside TransactionRunner.run()');
      }
      await tx.$queryRaw`
        SELECT variant_id FROM inventory
        WHERE variant_id IN (${Prisma.join(variantIds.map((id) => Prisma.sql`${id}::uuid`))})
        ORDER BY variant_id FOR UPDATE
      `;
    }
    const rows = await tx.inventory.findMany({ where: { variantId: { in: variantIds } } });
    return rows.map(({ variantId, quantity, reservedQuantity }) => ({ variantId, quantity, reservedQuantity }));
  }

  async setQuantity(variantId: string, quantity: number): Promise<void> {
    await this.txHost.tx.inventory.update({ where: { variantId }, data: { quantity } });
  }

  async decrementIfSufficient(variantId: string, quantity: number, reservedQuantity: number): Promise<boolean> {
    const updated = await this.txHost.tx.inventory.updateMany({
      where: { variantId, quantity: { gte: quantity + reservedQuantity } },
      data: { quantity: { decrement: quantity } },
    });
    return updated.count === 1;
  }

  async addMovement(movement: NewInventoryMovement): Promise<void> {
    await this.txHost.tx.inventoryMovement.create({ data: movement });
  }

  async sumAwaitingQuantity(variantId: string): Promise<number> {
    const awaiting = await this.txHost.tx.awaitingDispatchItem.aggregate({
      where: { variantId },
      _sum: { quantity: true },
    });
    return awaiting._sum.quantity ?? 0;
  }

  async addAwaitingDispatch(orderId: string, lines: StockLine[]): Promise<void> {
    await this.txHost.tx.awaitingDispatchItem.createMany({
      data: lines.map((line) => ({ orderId, variantId: line.variantId, quantity: line.quantity })),
    });
  }

  createStockCount(count: NewStockCount): Promise<StockCount> {
    return this.txHost.tx.inventoryStockCount.create({ data: count });
  }

  findStockCount(id: string): Promise<StockCount | null> {
    return this.txHost.tx.inventoryStockCount.findUnique({ where: { id } });
  }

  confirmStockCount(id: string, confirmation: StockCountConfirmation): Promise<StockCount> {
    return this.txHost.tx.inventoryStockCount.update({ where: { id }, data: confirmation });
  }
}
