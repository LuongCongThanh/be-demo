import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { AdminCategoryService } from '#src/modules/catalog/category/admin/application/category/admin-category.service.js';
import { CategoryLanguageService } from '#src/modules/catalog/category/application/shared/localization/category-language.service.js';
import { categoryRepositoryProviders } from '#src/modules/catalog/category/testing/category-test-setup.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type TestLanguage = { locale: string; enabled: boolean; generation: number };

describe('category creation and language enablement', () => {
  it('does not miss a category created while a locale is enabled', async () => {
    const categories = new Map<string, { id: string; sourceVersion: number }>();
    const translations = new Map<string, Record<string, unknown>>();
    const languages = new Map<string, TestLanguage>([
      ['vi', { locale: 'vi', enabled: true, generation: 0 }],
      ['fr', { locale: 'fr', enabled: false, generation: 0 }],
    ]);
    const categoryCreateReached = deferred();
    const allowCategoryCreate = deferred();
    const categorySnapshotTaken = deferred();
    const secondLockAttempt = deferred();

    let lockTail = Promise.resolve();
    let lockCalls = 0;
    const acquireLock = async () => {
      let release!: () => void;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      const previous = lockTail;
      lockTail = current;
      await previous;
      return release;
    };

    const prisma = {
      categoryLanguage: {
        findMany: vi.fn(async () =>
          [...languages.values()]
            .filter((language) => language.enabled)
            .map(({ locale, generation }) => ({ locale, generation })),
        ),
        findUnique: vi.fn(async ({ where }: { where: { locale: string } }) => languages.get(where.locale) ?? null),
        update: vi.fn(async ({ where, data }: { where: { locale: string }; data: Partial<TestLanguage> }) => {
          const language = languages.get(where.locale);
          if (!language) throw new Error(`Unknown language ${where.locale}`);
          Object.assign(language, data);
          return language;
        }),
      },
      category: {
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => {
          const snapshot = [...categories.values()];
          categorySnapshotTaken.resolve();
          return snapshot;
        }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          categoryCreateReached.resolve();
          await allowCategoryCreate.promise;
          const category = { id: 'category-1', sourceVersion: 0, ...data };
          categories.set(category.id, category);
          const nestedTranslations = (
            data.translations as { create: Record<string, unknown> | Record<string, unknown>[] }
          ).create;
          for (const translation of Array.isArray(nestedTranslations) ? nestedTranslations : [nestedTranslations]) {
            translations.set(`${category.id}:${translation.locale}`, { categoryId: category.id, ...translation });
          }
          return category;
        }),
      },
      categoryTranslation: {
        findUnique: vi.fn(
          async ({ where }: { where: { categoryId_locale: { categoryId: string; locale: string } } }) =>
            translations.get(`${where.categoryId_locale.categoryId}:${where.categoryId_locale.locale}`) ?? null,
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { categoryId_locale: { categoryId: string; locale: string } };
            data: Record<string, unknown>;
          }) => {
            const key = `${where.categoryId_locale.categoryId}:${where.categoryId_locale.locale}`;
            const translation = translations.get(key);
            if (!translation) throw new Error(`Missing translation ${key}`);
            Object.assign(translation, data);
            return translation;
          },
        ),
        upsert: vi.fn(
          async ({
            where,
            create,
            update,
          }: {
            where: { categoryId_locale: { categoryId: string; locale: string } };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => {
            const key = `${where.categoryId_locale.categoryId}:${where.categoryId_locale.locale}`;
            const existing = translations.get(key);
            if (existing) Object.assign(existing, update);
            else translations.set(key, create);
            return translations.get(key);
          },
        ),
      },
      $transaction: vi.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
        let releaseLock: (() => void) | undefined;
        const tx = {
          categoryLanguage: prisma.categoryLanguage,
          category: prisma.category,
          categoryTranslation: prisma.categoryTranslation,
          $queryRaw: async () => {
            lockCalls++;
            if (lockCalls === 2) secondLockAttempt.resolve();
            if (!releaseLock) releaseLock = await acquireLock();
            return [];
          },
        };
        try {
          return await callback(tx);
        } finally {
          releaseLock?.();
        }
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AdminCategoryService, CategoryLanguageService, ...categoryRepositoryProviders(prisma)],
    }).compile();
    const adminCategories = moduleRef.get(AdminCategoryService);
    const categoryLanguages = moduleRef.get(CategoryLanguageService);

    const createPromise = adminCategories.create({ name: 'Concurrent Category' });
    await categoryCreateReached.promise;
    const enablePromise = categoryLanguages.setEnabled('fr', true);
    await Promise.race([categorySnapshotTaken.promise, secondLockAttempt.promise]);

    allowCategoryCreate.resolve();
    await Promise.all([createPromise, enablePromise]);

    expect(translations.has('category-1:fr')).toBe(true);
    await moduleRef.close();
  });
});
