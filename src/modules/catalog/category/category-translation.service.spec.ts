import { describe, expect, it, vi } from 'vitest';
import { CategoryTranslationService } from '#src/modules/catalog/category/category-translation.service.js';
import type { CategoryTranslationClient } from '#src/modules/catalog/category/category-translation.client.js';
import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import type { CategoryTranslationStatus } from '#src/generated/prisma/enums.js';

function setup() {
  const row = {
    categoryId: 'cat',
    locale: 'en',
    sourceVersion: 0,
    category: { name: 'Áo thun', sourceVersion: 0 },
    name: null as string | null,
    status: 'PENDING' as CategoryTranslationStatus,
    revision: 0,
    leaseUntil: null as Date | null,
  };
  const prisma = {
    categoryTranslation: {
      findMany: vi.fn(async () => (row.status === 'PENDING' ? [{ ...row }] : [])),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: {
            sourceVersion: number;
            category: { sourceVersion: number };
            revision: number;
            status: string;
            leaseUntil?: Date;
            OR?: unknown;
          };
          data: Partial<typeof row>;
        }) => {
          if (
            where.category.sourceVersion !== row.category.sourceVersion ||
            where.sourceVersion !== row.sourceVersion ||
            where.revision !== row.revision ||
            where.status !== row.status
          )
            return { count: 0 };
          if (where.leaseUntil && where.leaseUntil.getTime() !== row.leaseUntil?.getTime()) return { count: 0 };
          if (where.OR && row.leaseUntil && row.leaseUntil > new Date()) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
      ),
    },
  };
  const translator = { enabled: true, translate: vi.fn(async () => 'T-shirts') };
  const service = new CategoryTranslationService(
    prisma as unknown as PrismaService,
    translator as unknown as CategoryTranslationClient,
  );
  return { row, prisma, translator, service };
}

describe('durable category translation worker', () => {
  it('translates pending rows and clears the lease', async () => {
    const { row, service } = setup();
    await service.tick();
    expect(row).toMatchObject({ name: 'T-shirts', status: 'TRANSLATED', leaseUntil: null });
  });
  it.each(['MANUAL', 'REVIEW', 'FAILED', 'TRANSLATED'] as const)('does not backfill %s names', async (status) => {
    const { row, service, translator } = setup();
    row.status = status;
    await service.tick();
    expect(translator.translate).not.toHaveBeenCalled();
  });
  it('leaves work pending when credentials are absent', async () => {
    const { service, translator, prisma } = setup();
    translator.enabled = false;
    await service.tick();
    expect(prisma.categoryTranslation.findMany).not.toHaveBeenCalled();
  });
  it('marks provider failures for explicit retry', async () => {
    const { row, service, translator } = setup();
    translator.translate.mockRejectedValue(new Error('offline'));
    await service.tick();
    expect(row).toMatchObject({ status: 'FAILED', leaseUntil: null });
  });
  it.each(['rename', 'manual', 'retry'] as const)('discards an old provider result after %s', async (change) => {
    const { row, service, translator } = setup();
    translator.translate.mockImplementation(async () => {
      row.revision++;
      row.status = change === 'manual' ? 'MANUAL' : 'PENDING';
      row.name = change === 'manual' ? 'Editorial name' : null;
      return 'Old name';
    });
    await service.tick();
    expect(row.name).toBe(change === 'manual' ? 'Editorial name' : null);
  });
  it('recovers an expired lease but skips work leased by another instance', async () => {
    const { row, service, translator } = setup();
    row.leaseUntil = new Date(Date.now() + 60_000);
    await service.tick();
    expect(translator.translate).not.toHaveBeenCalled();
    row.leaseUntil = new Date(0);
    await service.tick();
    expect(row.status).toBe('TRANSLATED');
  });
});
