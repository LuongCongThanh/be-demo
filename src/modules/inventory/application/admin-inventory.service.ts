import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '#src/common/errors/business-errors.js';
import { TransactionRunner } from '#src/infrastructure/database/transaction-runner.port.js';
import { InventoryRepository } from '#src/modules/inventory/application/ports/inventory.repository.js';
import type { InventoryLevel } from '#src/modules/inventory/domain/inventory.model.js';

@Injectable()
export class AdminInventoryService {
  constructor(
    private readonly inventory: InventoryRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async getAvailability(variantId: string) {
    return this.availability(await this.requireLevel(variantId));
  }

  async adjust(variantId: string, actorUserId: string, dto: { delta: number; reason: string }) {
    if (!Number.isInteger(dto.delta) || dto.delta === 0) {
      // 409 is kept on purpose to preserve the existing status (refactor-only).
      throw new ConflictError('Delta must be a non-zero integer');
    }
    return this.transactionRunner.run(async () => {
      const inventory = await this.requireLevel(variantId, true);
      const available = inventory.quantity - inventory.reservedQuantity;
      if (dto.delta < 0 && Math.abs(dto.delta) > available) {
        throw new ConflictError(`Maximum decrease is ${available}`);
      }
      const afterQuantity = inventory.quantity + dto.delta;
      if (afterQuantity < 0) throw new ConflictError('Inventory cannot become negative');

      await this.inventory.setQuantity(variantId, afterQuantity);
      await this.inventory.addMovement({
        variantId,
        actorUserId,
        reason: dto.reason,
        quantityDelta: dto.delta,
        beforeQuantity: inventory.quantity,
        afterQuantity,
        beforeReserved: inventory.reservedQuantity,
        afterReserved: inventory.reservedQuantity,
      });
      return this.availability({ ...inventory, quantity: afterQuantity });
    });
  }

  async createCount(variantId: string, actorUserId: string, dto: { physicalCount: number }) {
    return this.transactionRunner.run(async () => {
      const inventory = await this.requireLevel(variantId, true);
      const awaitingQuantity = await this.inventory.sumAwaitingQuantity(variantId);
      return this.inventory.createStockCount({
        variantId,
        actorUserId,
        physicalCount: dto.physicalCount,
        onShelfAtCount: inventory.quantity,
        awaitingAtCount: awaitingQuantity,
        discrepancy: dto.physicalCount - inventory.quantity - awaitingQuantity,
      });
    });
  }

  async confirmCount(countId: string, actorUserId: string) {
    return this.transactionRunner.run(async () => {
      const count = await this.inventory.findStockCount(countId);
      if (!count) throw new NotFoundError('Stock count not found');
      if (count.confirmedAt) return count;

      const inventory = await this.requireLevel(count.variantId, true);
      const awaitingQuantity = await this.inventory.sumAwaitingQuantity(count.variantId);
      const expectedQuantity = inventory.quantity + awaitingQuantity;
      const delta = count.physicalCount - expectedQuantity;
      const available = inventory.quantity - inventory.reservedQuantity;
      if (delta < 0 && Math.abs(delta) > available) {
        throw new ConflictError(`Maximum decrease is ${available}`);
      }
      if (inventory.quantity + delta < 0) throw new ConflictError('Confirmed count cannot create negative inventory');

      await this.inventory.setQuantity(count.variantId, inventory.quantity + delta);
      await this.inventory.addMovement({
        variantId: count.variantId,
        actorUserId,
        reason: `Stock count confirmation ${count.id}`,
        quantityDelta: delta,
        beforeQuantity: inventory.quantity,
        afterQuantity: inventory.quantity + delta,
        beforeReserved: inventory.reservedQuantity,
        afterReserved: inventory.reservedQuantity,
      });
      return this.inventory.confirmStockCount(countId, {
        onShelfAtCount: inventory.quantity,
        awaitingAtCount: awaitingQuantity,
        discrepancy: delta,
        confirmedAt: new Date(),
      });
    });
  }

  private async requireLevel(variantId: string, lockForUpdate = false): Promise<InventoryLevel> {
    const [inventory] = await this.inventory.findLevels([variantId], { lockForUpdate });
    if (!inventory) throw new NotFoundError('Inventory not found');
    return inventory;
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
