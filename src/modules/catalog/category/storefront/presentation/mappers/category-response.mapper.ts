import type { CategoryImageStorage } from '#src/modules/catalog/category/application/ports/storage/category-image.storage.js';
import type { CategoryLocale } from '#src/modules/catalog/category/domain/localization/category-locale.js';
import type { CategoryWithTranslations } from '#src/modules/catalog/category/domain/models/category.model.js';
import type { CategoryTreeNode } from '#src/modules/catalog/category/domain/tree/category-tree.js';
import type { CategoryTreeNodeDto } from '#src/modules/catalog/category/storefront/dto/category/category-tree-node.dto.js';

export function categoryContent(
  category: CategoryWithTranslations,
  storage: CategoryImageStorage,
  locale: CategoryLocale = 'vi',
) {
  const english = category.translations.find((translation) => translation.locale === 'en');
  const resolved = category.translations.find((translation) => translation.locale === locale);
  const resolvedName = resolved?.name ?? null;
  return {
    name: locale === 'vi' ? category.name : (resolvedName ?? category.name),
    nameVi: category.name,
    nameEn: english?.name ?? null,
    thumbnailUrl: category.thumbnailStorageKey ? storage.publicUrl(category.thumbnailStorageKey) : null,
    bannerUrl: category.bannerStorageKey ? storage.publicUrl(category.bannerStorageKey) : null,
  };
}

export function publicCategory(
  category: CategoryWithTranslations,
  storage: CategoryImageStorage,
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

export function publicCategoryTree(
  nodes: CategoryTreeNode<CategoryWithTranslations>[],
  storage: CategoryImageStorage,
  locale: CategoryLocale,
): CategoryTreeNodeDto[] {
  return nodes.map(({ category, children }) => ({
    id: category.id,
    slug: category.slug,
    ...categoryContent(category, storage, locale),
    children: publicCategoryTree(children, storage, locale),
  }));
}
