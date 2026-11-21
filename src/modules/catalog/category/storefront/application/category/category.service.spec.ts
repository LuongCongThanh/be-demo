import { describe, expect, it, vi } from 'vitest';
import { CategoryNotFoundError } from '#src/modules/catalog/category/domain/errors/category-errors.js';
import { CategoryService } from '#src/modules/catalog/category/storefront/application/category/category.service.js';

const base = {
  sourceVersion: 0,
  nameEn: null,
  translationStatus: 'PENDING' as const,
  translationVersion: 0,
  translationLeaseUntil: null,
  translations: [],
  thumbnailStorageKey: null,
  bannerStorageKey: null,
  description: null,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe('CategoryService (storefront)', () => {
  const repository = {
    findAllCategoriesWithTranslations: vi.fn().mockResolvedValue([
      { ...base, id: 'root', parentId: null, name: 'Root', slug: 'root', isVisible: true },
      { ...base, id: 'hidden', parentId: 'root', name: 'Hidden', slug: 'hidden', isVisible: false },
    ]),
  };
  const service = new CategoryService(repository);

  it('returns the visible tree from a single query', async () => {
    const tree = await service.tree();
    expect(tree).toEqual([
      {
        category: expect.objectContaining({ id: 'root', name: 'Root', slug: 'root' }),
        children: [],
      },
    ]);
    expect(repository.findAllCategoriesWithTranslations).toHaveBeenCalledTimes(1);
  });

  it('findVisible returns a visible category and 404s a hidden one', async () => {
    await expect(service.findVisible('root')).resolves.toMatchObject({ id: 'root' });
    await expect(service.findVisible('hidden')).rejects.toThrow(CategoryNotFoundError);
  });
  it('uses stored English names without changing the URL identity', async () => {
    repository.findAllCategoriesWithTranslations.mockResolvedValueOnce([
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
    await expect(service.tree()).resolves.toMatchObject([
      { category: { id: 'root', name: 'Áo thun', slug: 'ao-thun' }, children: [] },
    ]);
  });
});
