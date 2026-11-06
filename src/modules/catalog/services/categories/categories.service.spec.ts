import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CategoriesService } from '#src/modules/catalog/services/categories/categories.service.js';
import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';

const base = { description: null, sortOrder: 0, createdAt: new Date(0), updatedAt: new Date(0) };

describe('CategoriesService (storefront)', () => {
  const prisma = {
    category: {
      findMany: vi.fn().mockResolvedValue([
        { ...base, id: 'root', parentId: null, name: 'Root', slug: 'root', isVisible: true },
        { ...base, id: 'hidden', parentId: 'root', name: 'Hidden', slug: 'hidden', isVisible: false },
      ]),
    },
  };
  const service = new CategoriesService(prisma as unknown as PrismaService);

  it('returns the visible tree from a single query', async () => {
    const tree = await service.tree();
    expect(tree).toEqual([{ id: 'root', name: 'Root', slug: 'root', children: [] }]);
    expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
  });

  it('findVisible returns a visible category and 404s a hidden one', async () => {
    await expect(service.findVisible('root')).resolves.toMatchObject({ id: 'root' });
    await expect(service.findVisible('hidden')).rejects.toThrow(NotFoundException);
  });
});
