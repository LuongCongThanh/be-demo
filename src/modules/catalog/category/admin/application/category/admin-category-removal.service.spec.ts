import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '#src/generated/prisma/client.js';
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

    await expect(service.remove('1')).rejects.toThrow(ConflictException);
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

    await expect(service.remove('1')).rejects.toThrow(ConflictException);
    expect(prismaMock.category.delete).not.toHaveBeenCalled();
  });

  it('propagates the delete error when the category does not exist', async () => {
    const notFoundError = new Error('Record not found');
    prismaMock.category.delete.mockRejectedValue(notFoundError);

    await expect(service.remove('missing-id')).rejects.toThrow(notFoundError);
  });

  it('maps a foreign-key race during delete to a conflict', async () => {
    prismaMock.category.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );

    await expect(service.remove('1')).rejects.toThrow(ConflictException);
  });
});
