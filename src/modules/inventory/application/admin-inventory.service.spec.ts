import { ConflictError } from '#src/common/errors/business-errors.js';
import { TransactionRunner } from '#src/infrastructure/database/transaction-runner.port.js';
import { AdminInventoryService } from '#src/modules/inventory/application/admin-inventory.service.js';
import { InventoryRepository } from '#src/modules/inventory/application/ports/inventory.repository.js';

class FakeInventoryRepository extends InventoryRepository {
  findLevels = vi.fn();
  setQuantity = vi.fn();
  decrementIfSufficient = vi.fn();
  addMovement = vi.fn();
  sumAwaitingQuantity = vi.fn();
  addAwaitingDispatch = vi.fn();
  createStockCount = vi.fn();
  findStockCount = vi.fn();
  confirmStockCount = vi.fn();
}

class FakeTransactionRunner extends TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}

function setup() {
  const repository = new FakeInventoryRepository();
  return { service: new AdminInventoryService(repository, new FakeTransactionRunner()), tx: repository };
}

describe('AdminInventoryService', () => {
  it('rejects a decrease above AvailableQuantity and reports the maximum', async () => {
    const { service, tx } = setup();
    tx.findLevels.mockResolvedValue([
      { variantId: '11111111-1111-4111-8111-111111111111', quantity: 10, reservedQuantity: 7 },
    ]);

    await expect(
      service.adjust('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', {
        delta: -4,
        reason: 'Damaged',
      }),
    ).rejects.toThrow(new ConflictError('Maximum decrease is 3'));
    expect(tx.setQuantity).not.toHaveBeenCalled();
  });

  it('creates an audit movement for an allowed increase', async () => {
    const { service, tx } = setup();
    tx.findLevels.mockResolvedValue([
      { variantId: '11111111-1111-4111-8111-111111111111', quantity: 10, reservedQuantity: 2 },
    ]);

    const result = await service.adjust(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      {
        delta: 5,
        reason: 'Received stock',
      },
    );

    expect(tx.addMovement).toHaveBeenCalledWith(
      expect.objectContaining({ quantityDelta: 5, beforeQuantity: 10, afterQuantity: 15 }),
    );
    expect(result.availableQuantity).toBe(13);
  });

  it('recalculates discrepancy from on-shelf plus awaiting-dispatch quantity at confirmation', async () => {
    const { service, tx } = setup();
    tx.findStockCount.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      variantId: '11111111-1111-4111-8111-111111111111',
      physicalCount: 20,
      confirmedAt: null,
    });
    tx.findLevels.mockResolvedValue([
      { variantId: '11111111-1111-4111-8111-111111111111', quantity: 15, reservedQuantity: 4 },
    ]);
    tx.sumAwaitingQuantity.mockResolvedValue(3);
    tx.confirmStockCount.mockResolvedValue({ confirmedAt: new Date() });

    await service.confirmCount('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222');

    expect(tx.setQuantity).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 17);
    expect(tx.addMovement).toHaveBeenCalledWith(
      expect.objectContaining({ quantityDelta: 2, beforeQuantity: 15, afterQuantity: 17 }),
    );
    expect(tx.confirmStockCount).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      expect.objectContaining({ onShelfAtCount: 15, awaitingAtCount: 3, discrepancy: 2 }),
    );
  });

  it('creates a stock count using on-shelf plus awaiting-dispatch quantities', async () => {
    const { service, tx } = setup();
    tx.findLevels.mockResolvedValue([
      { variantId: '11111111-1111-4111-8111-111111111111', quantity: 15, reservedQuantity: 4 },
    ]);
    tx.sumAwaitingQuantity.mockResolvedValue(3);
    tx.createStockCount.mockResolvedValue({});

    await service.createCount('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', {
      physicalCount: 20,
    });

    expect(tx.createStockCount).toHaveBeenCalledWith(
      expect.objectContaining({ onShelfAtCount: 15, awaitingAtCount: 3, discrepancy: 2 }),
    );
  });

  it('rejects a count decrease above AvailableQuantity', async () => {
    const { service, tx } = setup();
    tx.findStockCount.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      variantId: '11111111-1111-4111-8111-111111111111',
      physicalCount: 16,
      confirmedAt: null,
    });
    tx.findLevels.mockResolvedValue([
      { variantId: '11111111-1111-4111-8111-111111111111', quantity: 15, reservedQuantity: 14 },
    ]);
    tx.sumAwaitingQuantity.mockResolvedValue(3);

    await expect(
      service.confirmCount('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222'),
    ).rejects.toThrow(new ConflictError('Maximum decrease is 1'));
    expect(tx.setQuantity).not.toHaveBeenCalled();
  });

  it('returns the count confirmed by a concurrent request without adjusting stock again', async () => {
    const { service, tx } = setup();
    const base = {
      id: '33333333-3333-4333-8333-333333333333',
      variantId: '11111111-1111-4111-8111-111111111111',
      physicalCount: 13,
    };
    const confirmed = { ...base, confirmedAt: new Date('2026-11-27T00:00:00Z') };
    // First read is taken before the row lock and is stale; the read after the lock sees the other confirm.
    tx.findStockCount.mockResolvedValueOnce({ ...base, confirmedAt: null }).mockResolvedValueOnce(confirmed);
    tx.findLevels.mockResolvedValue([{ variantId: base.variantId, quantity: 13, reservedQuantity: 0 }]);

    await expect(service.confirmCount(base.id, '22222222-2222-4222-8222-222222222222')).resolves.toBe(confirmed);
    expect(tx.findLevels).toHaveBeenCalledWith([base.variantId], { lockForUpdate: true });
    // The second read must come after the row lock, otherwise it could still be stale.
    expect(tx.findStockCount).toHaveBeenCalledTimes(2);
    expect(tx.findLevels.mock.invocationCallOrder[0]).toBeLessThan(tx.findStockCount.mock.invocationCallOrder[1]!);
    expect(tx.findLevels.mock.invocationCallOrder[0]).toBeGreaterThan(tx.findStockCount.mock.invocationCallOrder[0]!);
    expect(tx.setQuantity).not.toHaveBeenCalled();
    expect(tx.addMovement).not.toHaveBeenCalled();
    expect(tx.confirmStockCount).not.toHaveBeenCalled();
  });

  it('returns the stored count and writes nothing when the conditional confirm updates no row', async () => {
    const { service, tx } = setup();
    const base = {
      id: '33333333-3333-4333-8333-333333333333',
      variantId: '11111111-1111-4111-8111-111111111111',
      physicalCount: 13,
    };
    const stored = { ...base, confirmedAt: new Date('2026-11-27T00:00:00Z') };
    // Both reads still see an unconfirmed count; only the guarded update reveals the other confirm.
    tx.findStockCount
      .mockResolvedValueOnce({ ...base, confirmedAt: null })
      .mockResolvedValueOnce({ ...base, confirmedAt: null })
      .mockResolvedValueOnce(stored);
    tx.findLevels.mockResolvedValue([{ variantId: base.variantId, quantity: 10, reservedQuantity: 0 }]);
    tx.sumAwaitingQuantity.mockResolvedValue(0);
    tx.confirmStockCount.mockResolvedValue(null);

    await expect(service.confirmCount(base.id, '22222222-2222-4222-8222-222222222222')).resolves.toBe(stored);
    expect(tx.setQuantity).not.toHaveBeenCalled();
    expect(tx.addMovement).not.toHaveBeenCalled();
  });
});
