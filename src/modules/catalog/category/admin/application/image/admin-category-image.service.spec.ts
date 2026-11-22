import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCategoryImageService } from '#src/modules/catalog/category/admin/application/image/admin-category-image.service.js';
import { CategoryImageSlot } from '#src/modules/catalog/category/domain/image/category-image-slot.enum.js';
import type { CategoryImageRepository } from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';
import type {
  CategoryImageStorage,
  StoredCategoryImage,
} from '#src/modules/catalog/category/application/ports/storage/category-image.storage.js';
import type { CategoryWithTranslations } from '#src/modules/catalog/category/domain/models/category.model.js';

const id = '550e8400-e29b-41d4-a716-446655440000';
const key = `categories/${id}/banner/550e8400-e29b-41d4-a716-446655440001`;
const findCategoryId = vi.fn(async (_id: string): Promise<string | null> => id);
const updateCategoryImage = vi.fn(
  async (_id: string, _slot: CategoryImageSlot, storageKey: string | null): Promise<CategoryWithTranslations> => ({
    id,
    parentId: null,
    name: 'Áo',
    slug: 'ao',
    description: null,
    sourceVersion: 0,
    nameEn: null,
    translationStatus: 'PENDING',
    translationVersion: 0,
    translationLeaseUntil: null,
    thumbnailStorageKey: null,
    bannerStorageKey: storageKey,
    sortOrder: 0,
    isVisible: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    translations: [],
  }),
);
const repository: CategoryImageRepository = { findCategoryId, updateCategoryImage };
const findImage = vi.fn(async (_key: string): Promise<StoredCategoryImage | null> => null);
const publicUrl = vi.fn((_key: string): string | null => null);
const signUpload = vi.fn();
const storage: CategoryImageStorage = { findImage, publicUrl, signUpload };
const service = new AdminCategoryImageService(repository, storage);

beforeEach(() => {
  vi.resetAllMocks();
  findCategoryId.mockResolvedValue(id);
});
describe('category media validation', () => {
  it.each([
    null,
    { bytes: 0, format: 'jpg' },
    { bytes: 5 * 1024 * 1024 + 1, format: 'jpg' },
    { bytes: 1024, format: 'svg' },
  ])('rejects missing, oversized or unsupported stored content', async (image) => {
    findImage.mockResolvedValue(image);
    await expect(service.set(id, CategoryImageSlot.BANNER, key)).rejects.toThrow(UnprocessableEntityException);
    expect(updateCategoryImage).not.toHaveBeenCalled();
  });
  it.each([
    key.replace('/banner/', '/thumbnail/'),
    key.replace(id, '550e8400-e29b-41d4-a716-446655440099'),
    `${key}/../other`,
    'https://external.test/image.jpg',
  ])('rejects keys outside the category and slot namespace', async (badKey) => {
    await expect(service.set(id, CategoryImageSlot.BANNER, badKey)).rejects.toThrow(BadRequestException);
    expect(findImage).not.toHaveBeenCalled();
  });
  it('persists an uploaded image key only after verifying the stored content', async () => {
    findImage.mockResolvedValue({ bytes: 1024, format: 'webp' });
    await expect(service.set(id, CategoryImageSlot.BANNER, key)).resolves.toMatchObject({
      bannerStorageKey: key,
    });
    expect(updateCategoryImage).toHaveBeenCalledWith(id, CategoryImageSlot.BANNER, key);
  });
  it('clears a slot without depending on storage availability', async () => {
    await expect(service.set(id, CategoryImageSlot.BANNER, null)).resolves.toMatchObject({ bannerStorageKey: null });
    expect(findImage).not.toHaveBeenCalled();
  });
  it('does not sign an upload for a missing category', async () => {
    findCategoryId.mockResolvedValue(null);
    await expect(service.presign(id, CategoryImageSlot.BANNER)).rejects.toThrow(NotFoundException);
    expect(signUpload).not.toHaveBeenCalled();
  });
});
