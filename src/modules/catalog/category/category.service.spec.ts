import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CategoryService } from '#src/modules/catalog/category/category.service.js';
import type { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';
import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';

const base = {
  nameEn: null,
  translations: [] as { locale: string; name: string }[],
  thumbnailStorageKey: null,
  bannerStorageKey: null,
  description: null,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe('CategoryService (storefront)', () => {
  const prisma = {
    category: {
      findMany: vi.fn().mockResolvedValue([
        { ...base, id: 'root', parentId: null, name: 'Root', slug: 'root', isVisible: true },
        { ...base, id: 'hidden', parentId: 'root', name: 'Hidden', slug: 'hidden', isVisible: false },
      ]),
    },
  };
  const service = new CategoryService(
    prisma as unknown as PrismaService,
    { publicUrl: () => null } as unknown as CloudinaryClient,
  );

  it('returns the visible tree from a single query', async () => {
    const tree = await service.tree();
    expect(tree).toEqual([
      {
        id: 'root',
        name: 'Root',
        slug: 'root',
        nameVi: 'Root',
        nameEn: null,
        thumbnailUrl: null,
        bannerUrl: null,
        children: [],
      },
    ]);
    expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
  });

  it('findVisible returns a visible category and 404s a hidden one', async () => {
    await expect(service.findVisible('root')).resolves.toMatchObject({ id: 'root' });
    await expect(service.findVisible('hidden')).rejects.toThrow(NotFoundException);
  });
  it('uses stored English names without changing the URL identity', async () => {
    prisma.category.findMany.mockResolvedValueOnce([
      {
        ...base,
        id: 'root',
        parentId: null,
        name: 'Áo thun',
        nameEn: 'Retired value',
        translations: [{ locale: 'en', name: 'T-shirt' }],
        slug: 'ao-thun',
        isVisible: true,
      },
    ]);
    await expect(service.tree('en')).resolves.toMatchObject([
      { id: 'root', name: 'T-shirt', nameVi: 'Áo thun', slug: 'ao-thun' },
    ]);
  });
});
