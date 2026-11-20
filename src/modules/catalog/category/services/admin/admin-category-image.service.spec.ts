import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCategoryImageService } from '#src/modules/catalog/category/services/admin/admin-category-image.service.js';
import { CategoryImageSlot } from '#src/modules/catalog/category/domain/category-image-slot.enum.js';
import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import type { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';

const id = '550e8400-e29b-41d4-a716-446655440000';
const key = `categories/${id}/banner/550e8400-e29b-41d4-a716-446655440001`;
const prisma = { category: { findUnique: vi.fn(), update: vi.fn() } };
const storage = { findImage: vi.fn(), publicUrl: vi.fn(), signUpload: vi.fn() };
const service = new AdminCategoryImageService(
  prisma as unknown as PrismaService,
  storage as unknown as CloudinaryClient,
);

beforeEach(() => {
  vi.resetAllMocks();
  prisma.category.findUnique.mockResolvedValue({ id });
});
describe('category media validation', () => {
  it.each([
    null,
    { bytes: 0, format: 'jpg' },
    { bytes: 5 * 1024 * 1024 + 1, format: 'jpg' },
    { bytes: 1024, format: 'svg' },
  ])('rejects missing, oversized or unsupported stored content', async (image) => {
    storage.findImage.mockResolvedValue(image);
    await expect(service.set(id, CategoryImageSlot.BANNER, key)).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.category.update).not.toHaveBeenCalled();
  });
  it.each([
    key.replace('/banner/', '/thumbnail/'),
    key.replace(id, '550e8400-e29b-41d4-a716-446655440099'),
    `${key}/../other`,
    'https://external.test/image.jpg',
  ])('rejects keys outside the category and slot namespace', async (badKey) => {
    await expect(service.set(id, CategoryImageSlot.BANNER, badKey)).rejects.toThrow(BadRequestException);
    expect(storage.findImage).not.toHaveBeenCalled();
  });
  it('returns a storage URL only after verifying the uploaded content', async () => {
    storage.findImage.mockResolvedValue({ bytes: 1024, format: 'webp' });
    storage.publicUrl.mockReturnValue('https://images.test/banner');
    prisma.category.update.mockResolvedValue({ id, name: 'Áo', nameEn: null, translations: [], bannerStorageKey: key });
    expect(await service.set(id, CategoryImageSlot.BANNER, key)).toMatchObject({
      bannerUrl: 'https://images.test/banner',
    });
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id },
      data: { bannerStorageKey: key },
      include: { translations: true },
    });
  });
  it('clears a slot without depending on storage availability', async () => {
    prisma.category.update.mockResolvedValue({
      id,
      name: 'Áo',
      nameEn: null,
      translations: [],
      bannerStorageKey: null,
    });
    await expect(service.set(id, CategoryImageSlot.BANNER, null)).resolves.toMatchObject({ bannerUrl: null });
    expect(storage.findImage).not.toHaveBeenCalled();
  });
  it('does not sign an upload for a missing category', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(service.presign(id, CategoryImageSlot.BANNER)).rejects.toThrow(NotFoundException);
    expect(storage.signUpload).not.toHaveBeenCalled();
  });
});
