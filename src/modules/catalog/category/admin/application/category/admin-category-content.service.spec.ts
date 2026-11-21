import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '#src/generated/prisma/client.js';
import {
  CategoryConflictError,
  CategoryInvalidInputError,
  CategoryNotFoundError,
} from '#src/modules/catalog/category/domain/errors/category-errors.js';
import { categoryTranslations } from '#src/modules/catalog/category/infrastructure/persistence/relational/queries/category-prisma-selects.js';
import { categoryRepositoryProviders } from '#src/modules/catalog/category/testing/category-test-setup.js';
import { AdminCategoryService } from '#src/modules/catalog/category/admin/application/category/admin-category.service.js';

describe('AdminCategoryService content and tree rules', () => {
  let service: AdminCategoryService;
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
      providers: [AdminCategoryService, ...categoryRepositoryProviders(prismaMock)],
    }).compile();

    service = moduleRef.get(AdminCategoryService);
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((callback) => callback(prismaMock));
  });

  describe('update', () => {
    it('preserves the original slug when the Vietnamese name changes', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce({
        id: '1',
        name: 'Shoes',
        slug: 'shoes',
        sourceVersion: 0,
        translations: [{ locale: 'en', revision: 0, status: 'PENDING' }],
      });
      prismaMock.category.update.mockResolvedValue({ id: '1', name: 'Sneakers', slug: 'shoes' });

      const result = await service.update('1', { name: 'Sneakers' });

      expect(prismaMock.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1', sourceVersion: 0, translations: { some: { locale: 'en', revision: 0 } } },
          data: expect.objectContaining({ name: 'Sneakers', sourceVersion: { increment: 1 } }),
          include: categoryTranslations,
        }),
      );
      expect(result.slug).toBe('shoes');
    });

    it('does not touch the slug when name is not part of the update', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce({
        id: '1',
        name: 'Shoes',
        slug: 'shoes',
        sourceVersion: 0,
        translations: [{ locale: 'en', revision: 0, status: 'PENDING' }],
      });
      prismaMock.category.update.mockResolvedValue({ id: '1', name: 'Shoes', slug: 'shoes', description: 'Updated' });

      await service.update('1', { description: 'Updated' });

      expect(prismaMock.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { description: 'Updated' },
        }),
      );
    });

    it('throws a domain not-found error when the category does not exist', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce(null);
      await expect(service.update('missing-id', { name: 'X' })).rejects.toThrow(CategoryNotFoundError);
    });

    it('reports a concurrent content edit as 409 rather than silently overwriting it', async () => {
      prismaMock.category.findUnique.mockResolvedValue({
        id: '1',
        name: 'Áo thun',
        sourceVersion: 3,
        translations: [{ locale: 'en', name: 'T-shirts', status: 'MANUAL', revision: 2 }],
      });
      prismaMock.category.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Stale version', { code: 'P2025', clientVersion: 'test' }),
      );

      await expect(service.update('1', { nameEn: 'T-shirts' })).rejects.toThrow(CategoryConflictError);
    });
  });

  describe('translation lifecycle during category content updates', () => {
    it.each(['MANUAL', 'REVIEW'])('keeps editorial English after Vietnamese rename (%s)', async (status) => {
      prismaMock.category.findUnique.mockResolvedValue({
        id: '1',
        name: 'Áo thun',
        sourceVersion: 3,
        translations: [{ locale: 'en', name: 'T-shirts', status, revision: 2 }],
      });
      prismaMock.category.update.mockResolvedValue({ id: '1' });

      await service.update('1', { name: 'Áo polo' });

      expect(prismaMock.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'Áo polo',
            sourceVersion: { increment: 1 },
            translations: {
              update: [
                {
                  where: { categoryId_locale: { categoryId: '1', locale: 'en' }, revision: 2 },
                  data: { status: 'REVIEW', sourceVersion: 4, revision: { increment: 1 }, leaseUntil: null },
                },
              ],
            },
          },
        }),
      );
    });

    it.each(['Polo shirts', null])('writes an English override into the locale row (%s)', async (name) => {
      prismaMock.category.findUnique.mockResolvedValue({
        id: '1',
        name: 'Áo thun',
        sourceVersion: 3,
        translations: [{ locale: 'en', name: 'T-shirts', status: 'MANUAL', revision: 2 }],
      });
      prismaMock.category.update.mockResolvedValue({ id: '1' });

      await service.update('1', { name: 'Áo polo', nameEn: name });

      expect(prismaMock.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            translations: {
              update: [
                {
                  where: { categoryId_locale: { categoryId: '1', locale: 'en' }, revision: 2 },
                  data: expect.objectContaining({
                    name,
                    status: name === null ? 'PENDING' : 'MANUAL',
                    sourceVersion: 4,
                  }),
                },
              ],
            },
          }),
        }),
      );
    });
  });

  describe('tree rules (ADR 0001)', () => {
    it('create rejects an unknown parent with 404', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce(null);
      await expect(service.create({ name: 'Ao', parentId: 'missing' })).rejects.toThrow(CategoryNotFoundError);
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });

    it('update rejects making a category its own parent', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce({ id: 'a' });
      await expect(service.update('a', { parentId: 'a' })).rejects.toThrow(CategoryInvalidInputError);
    });

    it('rejects moving a category under its own descendant', async () => {
      const parents: Record<string, string | null> = { c: 'b', b: 'a', a: null };
      prismaMock.category.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id in parents
          ? {
              id: where.id,
              parentId: parents[where.id],
              sourceVersion: 0,
              translations: [{ locale: 'en', revision: 0 }],
            }
          : null,
      );

      await expect(service.update('a', { parentId: 'c' })).rejects.toThrow(CategoryInvalidInputError);
      expect(prismaMock.category.update).not.toHaveBeenCalled();
    });

    it('allows moving to an unrelated parent and back to root', async () => {
      const parents: Record<string, string | null> = { a: null, x: null };
      prismaMock.category.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id in parents
          ? {
              id: where.id,
              parentId: parents[where.id],
              sourceVersion: 0,
              translations: [{ locale: 'en', revision: 0 }],
            }
          : null,
      );
      prismaMock.category.update.mockResolvedValue({ id: 'a' });

      await service.update('a', { parentId: 'x' });
      await service.update('a', { parentId: null });

      expect(prismaMock.category.update).toHaveBeenCalledTimes(2);
    });

    it('rejects a destination with an already-corrupt cycle', async () => {
      const parents: Record<string, string | null> = { a: null, x: 'y', y: 'x' };
      prismaMock.category.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id in parents
          ? {
              id: where.id,
              parentId: parents[where.id],
              sourceVersion: 0,
              translations: [{ locale: 'en', revision: 0 }],
            }
          : null,
      );

      await expect(service.update('a', { parentId: 'x' })).rejects.toThrow(CategoryInvalidInputError);
    });
  });
});
