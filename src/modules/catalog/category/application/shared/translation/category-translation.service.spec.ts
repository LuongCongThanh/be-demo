import { describe, expect, it, vi } from 'vitest';
import { CategoryTranslationService } from '#src/modules/catalog/category/application/shared/translation/category-translation.service.js';
import type {
  CategoryTranslationJob,
  CategoryTranslationWorkerPort,
} from '#src/modules/catalog/category/application/ports/translation/category-translation-worker.port.js';

function setup(locale = 'en') {
  let enabledGeneration = 0;
  const row: {
    job: CategoryTranslationJob;
    name: string | null;
    status: 'PENDING' | 'TRANSLATED' | 'MANUAL' | 'REVIEW' | 'FAILED';
    leaseUntil: Date | null;
  } = {
    job: {
      categoryId: 'cat',
      locale,
      name: 'Áo thun',
      sourceVersion: 0,
      revision: 0,
      enableGeneration: 0,
    },
    name: null,
    status: 'PENDING',
    leaseUntil: null,
  };
  const isCurrent = (job: CategoryTranslationJob) =>
    row.job.categoryId === job.categoryId &&
    row.job.locale === job.locale &&
    row.job.sourceVersion === job.sourceVersion &&
    row.job.revision === job.revision &&
    row.job.enableGeneration === job.enableGeneration &&
    row.status === 'PENDING';
  const worker: CategoryTranslationWorkerPort = {
    findEnabledLocales: vi.fn(async () => [{ locale, generation: enabledGeneration }]),
    findPendingTranslations: vi.fn(async (locales, at) =>
      locales.includes(locale) && row.status === 'PENDING' && (!row.leaseUntil || row.leaseUntil <= at)
        ? [{ ...row.job }]
        : [],
    ),
    claimTranslation: vi.fn(async (job, now, leaseUntil) => {
      if (!isCurrent(job) || (row.leaseUntil && row.leaseUntil > now)) return false;
      row.leaseUntil = leaseUntil;
      return true;
    }),
    markTranslationFailed: vi.fn(async (job, leaseUntil) => {
      if (!isCurrent(job) || row.leaseUntil?.getTime() !== leaseUntil.getTime()) return false;
      row.status = 'FAILED';
      row.leaseUntil = null;
      return true;
    }),
    completeTranslation: vi.fn(async (job, leaseUntil, name) => {
      if (!isCurrent(job) || row.leaseUntil?.getTime() !== leaseUntil.getTime()) return false;
      row.name = name;
      row.status = 'TRANSLATED';
      row.leaseUntil = null;
      return true;
    }),
  };
  const translator = { enabled: true, translate: vi.fn(async () => 'T-shirts') };
  const service = new CategoryTranslationService(worker, translator);
  return {
    row,
    worker,
    translator,
    service,
    setEnabledGeneration: (generation: number) => {
      enabledGeneration = generation;
    },
  };
}

describe('durable category translation worker', () => {
  it.each(['en', 'fr', 'de'])(
    'translates pending %s rows using the target locale and clears the lease',
    async (locale) => {
      const { row, service, translator } = setup(locale);
      await service.tick();
      expect(row).toMatchObject({ name: 'T-shirts', status: 'TRANSLATED', leaseUntil: null });
      expect(translator.translate).toHaveBeenCalledWith('Áo thun', locale);
    },
  );
  it.each(['MANUAL', 'REVIEW', 'FAILED', 'TRANSLATED'] as const)('does not backfill %s names', async (status) => {
    const { row, service, translator } = setup();
    row.status = status;
    await service.tick();
    expect(translator.translate).not.toHaveBeenCalled();
  });
  it('leaves work pending when credentials are absent', async () => {
    const { service, translator, worker } = setup();
    translator.enabled = false;
    await service.tick();
    expect(worker.findPendingTranslations).not.toHaveBeenCalled();
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
      row.job.revision++;
      row.status = change === 'manual' ? 'MANUAL' : 'PENDING';
      row.name = change === 'manual' ? 'Editorial name' : null;
      return 'Old name';
    });
    await service.tick();
    expect(row.name).toBe(change === 'manual' ? 'Editorial name' : null);
  });
  it('discards an in-flight result from a previous disable/re-enable generation', async () => {
    const { row, service, translator, setEnabledGeneration } = setup('fr');
    translator.translate.mockImplementation(async () => {
      row.job.enableGeneration = 1;
      row.leaseUntil = null;
      setEnabledGeneration(1);
      return 'Stale translation';
    });

    await service.tick();

    expect(row).toMatchObject({
      name: null,
      status: 'PENDING',
      job: { enableGeneration: 1 },
      leaseUntil: null,
    });
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
