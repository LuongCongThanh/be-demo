import type { Category, CategoryTranslation } from '#src/generated/prisma/client.js';
import type { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';

export type CategoryWithTranslations = Category & { translations: CategoryTranslation[] };
export const categoryTranslations = { translations: { where: { locale: 'en' } } } as const;

/** Public names follow locale; all existing ids, slugs and Vietnamese defaults are preserved. */
export function categoryContent(
  category: CategoryWithTranslations,
  storage: CloudinaryClient,
  locale: 'vi' | 'en' = 'vi',
) {
  const english = category.translations.find((translation) => translation.locale === 'en');
  const nameEn = english?.name ?? null;
  return {
    name: locale === 'en' ? (nameEn ?? category.name) : category.name,
    nameVi: category.name,
    nameEn,
    thumbnailUrl: category.thumbnailStorageKey ? storage.publicUrl(category.thumbnailStorageKey) : null,
    bannerUrl: category.bannerStorageKey ? storage.publicUrl(category.bannerStorageKey) : null,
  };
}

export function publicCategory(
  category: CategoryWithTranslations,
  storage: CloudinaryClient,
  locale: 'vi' | 'en' = 'vi',
) {
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

export function adminCategory(category: CategoryWithTranslations, storage: CloudinaryClient) {
  return {
    ...publicCategory(category, storage),
    translationStatus: category.translations.find((translation) => translation.locale === 'en')?.status ?? 'PENDING',
    thumbnailStorageKey: category.thumbnailStorageKey,
    bannerStorageKey: category.bannerStorageKey,
  };
}
