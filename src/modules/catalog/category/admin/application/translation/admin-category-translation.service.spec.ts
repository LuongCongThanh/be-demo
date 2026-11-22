import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categoryTranslations } from '#src/modules/catalog/category/infrastructure/persistence/relational/queries/category-prisma-selects.js';
import { categoryRepositoryProviders } from '#src/modules/catalog/category/testing/category-test-setup.js';
import { AdminCategoryTranslationService } from '#src/modules/catalog/category/admin/application/translation/admin-category-translation.service.js';

describe('AdminCategoryTranslationService', () => {
  let service: AdminCategoryTranslationService;
  const prismaMock = {
    category: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(),
    categoryLanguage: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), update: vi.fn() },
    categoryTranslation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    product: { count: vi.fn() },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AdminCategoryTranslationService, ...categoryRepositoryProviders(prismaMock)],
    }).compile();

    service = moduleRef.get(AdminCategoryTranslationService);
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((callback) => callback(prismaMock));
  });

  it('retries English translation while retaining the current name until success', async () => {
    prismaMock.category.update.mockResolvedValue({ id: '1' });

    await service.retryTranslation('1');

    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: {
        translations: {
          update: {
            where: { categoryId_locale: { categoryId: '1', locale: 'en' } },
            data: { status: 'PENDING', revision: { increment: 1 }, leaseUntil: null },
          },
        },
      },
      include: categoryTranslations,
    });
  });

  it('lists translations only after locking and confirming the category exists', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ sourceVersion: 3 }]);
    prismaMock.categoryTranslation.findMany.mockResolvedValue([]);

    await service.listTranslations('1');

    expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
    expect(prismaMock.categoryTranslation.findMany).toHaveBeenCalledWith({
      where: { categoryId: '1' },
      orderBy: [{ locale: 'asc' }],
      select: { locale: true, name: true, status: true, updatedAt: true },
    });
  });

  it('rejects source locale edits before opening a transaction', async () => {
    await expect(service.updateTranslation('1', 'vi', 'Áo thun')).rejects.toThrow(BadRequestException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('creates a manual translation for an enabled locale', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ sourceVersion: 3 }]);
    prismaMock.categoryLanguage.findUnique.mockResolvedValue({ locale: 'fr', enabled: true, generation: 4 });
    prismaMock.categoryTranslation.findUnique.mockResolvedValue(null);
    prismaMock.categoryTranslation.create.mockResolvedValue({});
    prismaMock.categoryTranslation.findUniqueOrThrow.mockResolvedValue({
      locale: 'fr',
      name: 'Chemises',
      status: 'MANUAL',
      updatedAt: new Date(),
    });

    await service.updateTranslation('1', 'fr', 'Chemises');

    expect(prismaMock.categoryTranslation.create).toHaveBeenCalledWith({
      data: {
        categoryId: '1',
        locale: 'fr',
        name: 'Chemises',
        status: 'MANUAL',
        sourceVersion: 3,
        enableGeneration: 4,
      },
    });
  });

  it('reports stale translation revisions as conflicts', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ sourceVersion: 3 }]);
    prismaMock.categoryLanguage.findUnique.mockResolvedValue({ locale: 'fr', enabled: true, generation: 4 });
    prismaMock.categoryTranslation.findUnique.mockResolvedValue({
      revision: 2,
      sourceVersion: 3,
      enableGeneration: 4,
    });
    prismaMock.categoryTranslation.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.updateTranslation('1', 'fr', 'Chemises')).rejects.toThrow(ConflictException);
  });

  it('retries a locale without discarding its current translation', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ sourceVersion: 3 }]);
    prismaMock.categoryLanguage.findUnique.mockResolvedValue({ locale: 'fr', enabled: true, generation: 4 });
    prismaMock.categoryTranslation.findUnique.mockResolvedValue({
      revision: 2,
      sourceVersion: 3,
      enableGeneration: 4,
    });
    prismaMock.categoryTranslation.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.categoryTranslation.findUniqueOrThrow.mockResolvedValue({
      locale: 'fr',
      name: 'Chemises',
      status: 'PENDING',
      updatedAt: new Date(),
    });

    await service.retryLocaleTranslation('1', 'fr');

    expect(prismaMock.categoryTranslation.updateMany).toHaveBeenCalledWith({
      where: {
        categoryId: '1',
        locale: 'fr',
        revision: 2,
        sourceVersion: 3,
        enableGeneration: 4,
      },
      data: {
        status: 'PENDING',
        sourceVersion: 3,
        revision: { increment: 1 },
        enableGeneration: 4,
        leaseUntil: null,
      },
    });
  });
});
