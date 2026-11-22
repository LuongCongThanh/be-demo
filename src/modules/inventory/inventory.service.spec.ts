import { ConflictException } from '@nestjs/common';
import { InventoryService } from '#src/modules/inventory/inventory.service.js';

function setup() {
  const tx = {
    $queryRaw: vi.fn(),
    inventory: { findUnique: vi.fn(), update: vi.fn() },
    inventoryMovement: { create: vi.fn() },
    inventoryStockCount: { findUnique: vi.fn(), update: vi.fn() },
  };
  const prisma = {
    inventory: { findUnique: vi.fn(), update: vi.fn() },
    inventoryStockCount: { create: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn((fn: (tx: typeof tx) => unknown) => fn(tx)),
  };
  return { service: new InventoryService(prisma as never), prisma, tx };
}

describe('InventoryService', () => {
  it('rejects a decrease above AvailableQuantity and reports the maximum', async () => {
    const { service, tx } = setup();
    tx.inventory.findUnique.mockResolvedValue({
      variantId: '11111111-1111-4111-8111-111111111111',
      quantity: 10,
      reservedQuantity: 7,
    });

    await expect(
      service.adjust('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', {
        delta: -4,
        reason: 'Damaged',
      }),
    ).rejects.toThrow(new ConflictException('Maximum decrease is 3'));
    expect(tx.inventory.update).not.toHaveBeenCalled();
  });

  it('creates an audit movement for an allowed increase', async () => {
    const { service, tx } = setup();
    tx.inventory.findUnique.mockResolvedValue({
      variantId: '11111111-1111-4111-8111-111111111111',
      quantity: 10,
      reservedQuantity: 2,
    });

    const result = await service.adjust('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', {
      delta: 5,
      reason: 'Received stock',
    });

    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantityDelta: 5, beforeQuantity: 10, afterQuantity: 15 }),
      }),
    );
    expect(result.availableQuantity).toBe(13);
  });

  it('recalculates discrepancy from current on-shelf quantity at confirmation', async () => {
    const { service, tx } = setup();
    tx.inventoryStockCount.findUnique.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      variantId: '11111111-1111-4111-8111-111111111111',
      physicalCount: 20,
      confirmedAt: null,
    });
    tx.inventory.findUnique.mockResolvedValue({
      variantId: '11111111-1111-4111-8111-111111111111',
      quantity: 15,
      reservedQuantity: 4,
    });
    tx.inventoryStockCount.update.mockResolvedValue({ confirmedAt: new Date() });

    await service.confirmCount(
      '33333333-3333-4333-8333-333333333333',
      '22222222-2222-4222-8222-222222222222',
    );

    expect(tx.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantity: 20 } }),
    );
  });
});
