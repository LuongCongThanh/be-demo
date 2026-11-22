import type { CategoryImageStorage } from '#src/modules/catalog/category/application/ports/storage/category-image.storage.js';
import type { CategoryWithTranslations } from '#src/modules/catalog/category/domain/models/category.model.js';

export function adminCategory(category: CategoryWithTranslations, storage: CategoryImageStorage) {
  return {
    id: category.id,
    slug: category.slug,
    description: category.description,
    parentId: category.parentId,
    sortOrder: category.sortOrder,
    isVisible: category.isVisible,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    name: category.name,
    nameVi: category.name,
    nameEn: category.translations.find((translation) => translation.locale === 'en')?.name ?? null,
    thumbnailUrl: category.thumbnailStorageKey ? storage.publicUrl(category.thumbnailStorageKey) : null,
    bannerUrl: category.bannerStorageKey ? storage.publicUrl(category.bannerStorageKey) : null,
    translationStatus: category.translations.find((translation) => translation.locale === 'en')?.status ?? 'PENDING',
    thumbnailStorageKey: category.thumbnailStorageKey,
    bannerStorageKey: category.bannerStorageKey,
  };
}
