import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '#src/generated/prisma/client.js';
import { categoryTranslations } from '#src/modules/catalog/category/infrastructure/persistence/relational/queries/category-prisma-selects.js';
import { categoryRepositoryProviders } from '#src/modules/catalog/category/testing/category-test-setup.js';
import { AdminCategoryService } from '#src/modules/catalog/category/admin/application/category/admin-category.service.js';

describe('AdminCategoryService', () => {
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

  describe('create', () => {
    it('generates a slug and creates a category with an English translation row', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);
      prismaMock.category.create.mockResolvedValue({ id: '1', name: 'Shoes', slug: 'shoes', description: null });

      const result = await service.create({ name: 'Shoes' });

      expect(prismaMock.category.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'shoes' } }),
      );
      expect(prismaMock.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Shoes',
          slug: 'shoes',
          translations: { create: { locale: 'en', name: null, status: 'PENDING', enableGeneration: 0 } },
        },
        include: categoryTranslations,
      });
      expect(result.slug).toBe('shoes');
    });

    it('rejects duplicate names and empty slugs', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'existing', name: 'Shoes', slug: 'shoes' });
      await expect(service.create({ name: 'Shoes' })).rejects.toThrow(ConflictException);

      await expect(service.create({ name: '!!!' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });

    it('maps a concurrent slug uniqueness violation to a conflict', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);
      prismaMock.category.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['slug'] },
        }),
      );

      await expect(service.create({ name: 'Shoes' })).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns paginated data and metadata', async () => {
      prismaMock.category.findMany.mockResolvedValue([{ id: '1', name: 'Shoes', slug: 'shoes' }]);
      prismaMock.category.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(prismaMock.category.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: categoryTranslations,
      });
      expect(result).toEqual({
        data: [{ id: '1', name: 'Shoes', slug: 'shoes' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it('computes the offset for later pages', async () => {
      prismaMock.category.findMany.mockResolvedValue([]);
      prismaMock.category.count.mockResolvedValue(45);

      await service.findAll({ page: 3, limit: 20 });

      expect(prismaMock.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
    });
  });

  describe('findOne', () => {
    it('returns an existing category', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: '1', name: 'Shoes', slug: 'shoes' });
      await expect(service.findOne('1')).resolves.toEqual({ id: '1', name: 'Shoes', slug: 'shoes' });
    });

    it('throws NotFoundException when the category does not exist', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
