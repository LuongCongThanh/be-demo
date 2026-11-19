import type { Category } from '#src/generated/prisma/client.js';
import type { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';

/** Public names follow locale; all existing ids, slugs and Vietnamese defaults are preserved. */
export function categoryContent(category: Category, storage: CloudinaryClient, locale: 'vi' | 'en' = 'vi') {
  return {
    name: locale === 'en' ? (category.nameEn ?? category.name) : category.name,
    nameVi: category.name,
    nameEn: category.nameEn,
    thumbnailUrl: category.thumbnailStorageKey ? storage.publicUrl(category.thumbnailStorageKey) : null,
    bannerUrl: category.bannerStorageKey ? storage.publicUrl(category.bannerStorageKey) : null,
  };
}

export function publicCategory(category: Category, storage: CloudinaryClient, locale: 'vi' | 'en' = 'vi') {
  return {
    id: category.id,
    slug: category.slug,
    description: category.description,
    parentId: category.parentId,
    sortOrder: category.sortOrder,
    isVisible: category.isVisible,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    ...categoryContent(category, storage, locale),
  };
}

export function adminCategory(category: Category, storage: CloudinaryClient) {
  return {
    ...publicCategory(category, storage),
    translationStatus: category.translationStatus,
    thumbnailStorageKey: category.thumbnailStorageKey,
    bannerStorageKey: category.bannerStorageKey,
  };
}
