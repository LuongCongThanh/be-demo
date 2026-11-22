import { ConflictException } from '@nestjs/common';
import { InventoryService } from '#src/modules/inventory/inventory.service.js';

function setup() {
  const tx: {
    $queryRaw: ReturnType<typeof vi.fn>;
    inventory: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    inventoryMovement: { create: ReturnType<typeof vi.fn> };
    awaitingDispatchItem: { aggregate: ReturnType<typeof vi.fn> };
    inventoryStockCount: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  } = {
    $queryRaw: vi.fn(),
    inventory: { findUnique: vi.fn(), update: vi.fn() },
    inventoryMovement: { create: vi.fn() },
    awaitingDispatchItem: { aggregate: vi.fn() },
    inventoryStockCount: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  };
  const prisma = {
    inventory: { findUnique: vi.fn(), update: vi.fn() },
    awaitingDispatchItem: { aggregate: vi.fn() },
    inventoryStockCount: { create: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx)),
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

    const result = await service.adjust(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      {
        delta: 5,
        reason: 'Received stock',
      },
    );

    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantityDelta: 5, beforeQuantity: 10, afterQuantity: 15 }),
      }),
    );
    expect(result.availableQuantity).toBe(13);
  });

  it('recalculates discrepancy from on-shelf plus awaiting-dispatch quantity at confirmation', async () => {
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
    tx.awaitingDispatchItem.aggregate.mockResolvedValue({ _sum: { quantity: 3 } });
    tx.inventoryStockCount.update.mockResolvedValue({ confirmedAt: new Date() });

    await service.confirmCount('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222');

    expect(tx.inventory.update).toHaveBeenCalledWith(expect.objectContaining({ data: { quantity: 17 } }));
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantityDelta: 2, beforeQuantity: 15, afterQuantity: 17 }),
      }),
    );
    expect(tx.inventoryStockCount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ onShelfAtCount: 15, awaitingAtCount: 3, discrepancy: 2 }),
      }),
    );
  });

  it('creates a stock count using on-shelf plus awaiting-dispatch quantities', async () => {
    const { service, tx } = setup();
    tx.inventory.findUnique.mockResolvedValue({
      variantId: '11111111-1111-4111-8111-111111111111',
      quantity: 15,
      reservedQuantity: 4,
    });
    tx.awaitingDispatchItem.aggregate.mockResolvedValue({ _sum: { quantity: 3 } });
    tx.inventoryStockCount.create.mockResolvedValue({});

    await service.createCount('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', {
      physicalCount: 20,
    });

    expect(tx.inventoryStockCount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onShelfAtCount: 15,
          awaitingAtCount: 3,
          discrepancy: 2,
        }),
      }),
    );
  });

  it('rejects a count decrease above AvailableQuantity', async () => {
    const { service, tx } = setup();
    tx.inventoryStockCount.findUnique.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      variantId: '11111111-1111-4111-8111-111111111111',
      physicalCount: 16,
      confirmedAt: null,
    });
    tx.inventory.findUnique.mockResolvedValue({
      variantId: '11111111-1111-4111-8111-111111111111',
      quantity: 15,
      reservedQuantity: 14,
    });
    tx.awaitingDispatchItem.aggregate.mockResolvedValue({ _sum: { quantity: 3 } });

    await expect(
      service.confirmCount('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222'),
    ).rejects.toThrow(new ConflictException('Maximum decrease is 1'));
    expect(tx.inventory.update).not.toHaveBeenCalled();
  });
});
