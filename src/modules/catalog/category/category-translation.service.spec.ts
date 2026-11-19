import { describe, expect, it, vi } from 'vitest';
import { CategoryTranslationService } from '#src/modules/catalog/category/category-translation.service.js';
import type { CategoryTranslationClient } from '#src/modules/catalog/category/category-translation.client.js';
import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import type { CategoryTranslationStatus } from '#src/generated/prisma/enums.js';

function setup() {
  const row = {
    id: 'cat',
    name: 'Áo thun',
    nameEn: null as string | null,
    translationStatus: 'PENDING' as CategoryTranslationStatus,
    translationVersion: 0,
    translationLeaseUntil: null as Date | null,
  };
  const prisma = {
    category: {
      findMany: vi.fn(async () => (row.translationStatus === 'PENDING' ? [{ ...row }] : [])),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { translationVersion: number; translationStatus: string; translationLeaseUntil?: Date; OR?: unknown };
          data: Partial<typeof row>;
        }) => {
          if (where.translationVersion !== row.translationVersion || where.translationStatus !== row.translationStatus)
            return { count: 0 };
          if (
            where.translationLeaseUntil &&
            where.translationLeaseUntil.getTime() !== row.translationLeaseUntil?.getTime()
          )
            return { count: 0 };
          if (where.OR && row.translationLeaseUntil && row.translationLeaseUntil > new Date()) return { count: 0 };
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
    expect(row).toMatchObject({ nameEn: 'T-shirts', translationStatus: 'TRANSLATED', translationLeaseUntil: null });
  });
  it.each(['MANUAL', 'REVIEW', 'FAILED', 'TRANSLATED'] as const)('does not backfill %s names', async (status) => {
    const { row, service, translator } = setup();
    row.translationStatus = status;
    await service.tick();
    expect(translator.translate).not.toHaveBeenCalled();
  });
  it('leaves work pending when credentials are absent', async () => {
    const { service, translator, prisma } = setup();
    translator.enabled = false;
    await service.tick();
    expect(prisma.category.findMany).not.toHaveBeenCalled();
  });
  it('marks provider failures for explicit retry', async () => {
    const { row, service, translator } = setup();
    translator.translate.mockRejectedValue(new Error('offline'));
    await service.tick();
    expect(row).toMatchObject({ translationStatus: 'FAILED', translationLeaseUntil: null });
  });
  it.each(['rename', 'manual', 'retry'] as const)('discards an old provider result after %s', async (change) => {
    const { row, service, translator } = setup();
    translator.translate.mockImplementation(async () => {
      row.translationVersion++;
      row.translationStatus = change === 'manual' ? 'MANUAL' : 'PENDING';
      row.nameEn = change === 'manual' ? 'Editorial name' : null;
      return 'Old name';
    });
    await service.tick();
    expect(row.nameEn).toBe(change === 'manual' ? 'Editorial name' : null);
  });
  it('recovers an expired lease but skips work leased by another instance', async () => {
    const { row, service, translator } = setup();
    row.translationLeaseUntil = new Date(Date.now() + 60_000);
    await service.tick();
    expect(translator.translate).not.toHaveBeenCalled();
    row.translationLeaseUntil = new Date(0);
    await service.tick();
    expect(row.translationStatus).toBe('TRANSLATED');
  });
});
