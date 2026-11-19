import type { Category, CategoryTranslation } from '#src/generated/prisma/client.js';
import type { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';
import type { CategoryLocale } from '#src/modules/catalog/category/category-locale.js';

export type CategoryWithTranslations = Category & { translations: CategoryTranslation[] };
export const categoryTranslations = { translations: true } as const;

/** Public names follow locale; all existing ids, slugs and Vietnamese defaults are preserved. */
export function categoryContent(
  category: CategoryWithTranslations,
  storage: CloudinaryClient,
  locale: CategoryLocale = 'vi',
) {
  const english = category.translations.find((translation) => translation.locale === 'en');
  const resolved = category.translations.find((translation) => translation.locale === locale);
  const resolvedName = resolved?.name ?? null;
  const nameEn = english?.name ?? null;
  return {
    name: locale === 'vi' ? category.name : (resolvedName ?? category.name),
    nameVi: category.name,
    nameEn,
    thumbnailUrl: category.thumbnailStorageKey ? storage.publicUrl(category.thumbnailStorageKey) : null,
    bannerUrl: category.bannerStorageKey ? storage.publicUrl(category.bannerStorageKey) : null,
  };
}

export function publicCategory(
  category: CategoryWithTranslations,
  storage: CloudinaryClient,
  locale: CategoryLocale = 'vi',
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
