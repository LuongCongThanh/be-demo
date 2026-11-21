import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '#src/generated/prisma/client.js';
import {
  CategoryConflictError,
  CategoryNotFoundError,
} from '#src/modules/catalog/category/domain/errors/category-errors.js';
import { categoryRepositoryProviders } from '#src/modules/catalog/category/testing/category-test-setup.js';
import { AdminCategoryService } from '#src/modules/catalog/category/admin/application/category/admin-category.service.js';

describe('AdminCategoryService remove', () => {
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
    prismaMock.category.count.mockResolvedValue(0);
    prismaMock.product.count.mockResolvedValue(0);
  });

  it('rejects categories that still have subcategories', async () => {
    prismaMock.category.count.mockResolvedValue(2);

    await expect(service.remove('1')).rejects.toThrow(CategoryConflictError);
    expect(prismaMock.category.delete).not.toHaveBeenCalled();
  });

  it('deletes an empty leaf and checks products in every state', async () => {
    prismaMock.category.delete.mockResolvedValue(undefined);

    await service.remove('1');

    expect(prismaMock.product.count).toHaveBeenCalledWith({ where: { categoryId: '1' } });
    expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('rejects categories referenced by products', async () => {
    prismaMock.product.count.mockResolvedValue(3);

    await expect(service.remove('1')).rejects.toThrow(CategoryConflictError);
    expect(prismaMock.category.delete).not.toHaveBeenCalled();
  });

  it('maps a missing category on delete to a domain not-found error', async () => {
    const notFoundError = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });
    prismaMock.category.delete.mockRejectedValue(notFoundError);

    await expect(service.remove('missing-id')).rejects.toThrow(CategoryNotFoundError);
  });

  it('maps a foreign-key race during delete to a conflict', async () => {
    prismaMock.category.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );

    await expect(service.remove('1')).rejects.toThrow(CategoryConflictError);
  });
});
