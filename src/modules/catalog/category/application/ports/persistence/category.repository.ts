import type {
  CategoryLanguage,
  CategoryTranslation,
  CategoryTranslationStatus,
  CategoryWithTranslations,
} from '#src/modules/catalog/category/domain/models/category.model.js';
import type { CategoryImageSlot } from '#src/modules/catalog/category/domain/image/category-image-slot.enum.js';

export interface CategoryTranslationListItem {
  locale: string;
  name: string | null;
  status: CategoryTranslationStatus;
  updatedAt: Date;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
export const CATEGORY_TRANSLATION_REPOSITORY = Symbol('CATEGORY_TRANSLATION_REPOSITORY');
export const CATEGORY_LANGUAGE_REPOSITORY = Symbol('CATEGORY_LANGUAGE_REPOSITORY');

export interface CategoryCreateInput {
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
  translations: Array<{
    locale: string;
    name: string | null;
    status: 'MANUAL' | 'PENDING';
    enableGeneration: number;
  }>;
}

export interface CategoryMutableFields {
  name?: string;
  description?: string;
  parentId?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
}

export interface CategoryTranslationContentChange {
  locale: string;
  expectedRevision: number;
  name?: string | null;
  status: CategoryTranslationStatus;
  sourceVersion: number;
}

export interface CategoryContentUpdate {
  id: string;
  expectedSourceVersion: number;
  expectedEnglishRevision: number;
  fields: CategoryMutableFields;
  incrementSourceVersion: boolean;
  translations: CategoryTranslationContentChange[];
}

export interface CategoryTranslationRevision {
  revision: number;
  sourceVersion: number;
  enableGeneration: number;
}

export interface CategoryTranslationUpdate {
  categoryId: string;
  locale: string;
  revision: number;
  sourceVersion: number;
  enableGeneration: number;
  name?: string | null;
  status: CategoryTranslationStatus;
}

export interface CategoryTranslationWrite {
  categoryId: string;
  locale: string;
  name: string | null;
  status: 'PENDING' | 'MANUAL';
  sourceVersion: number;
  enableGeneration: number;
}

export interface CategorySourceVersion {
  id: string;
  sourceVersion: number;
}

export interface PendingCategoryTranslation {
  categoryId: string;
  locale: string;
  name: string | null;
  sourceVersion: number;
  enableGeneration: number;
}

export type CategoryDeleteResult = 'deleted' | 'restricted';

export interface CategoryPersistenceOperations {
  acquireCategoryLanguageWriteLock(): Promise<void>;
  acquireCategoryTreeWriteLock(): Promise<void>;
  findCategoryId(id: string): Promise<string | null>;
  findCategoryIdBySlug(slug: string): Promise<string | null>;
  findCategoryParentId(id: string): Promise<string | null>;
  findCategoryWithTranslations(id: string): Promise<CategoryWithTranslations | null>;
  findCategoryPage(skip: number, take: number): Promise<CategoryWithTranslations[]>;
  countCategories(): Promise<number>;
  findEnabledCategoryLanguages(): Promise<Array<{ locale: string; generation: number }>>;
  createCategory(input: CategoryCreateInput): Promise<CategoryWithTranslations>;
  updateCategoryContent(input: CategoryContentUpdate): Promise<CategoryWithTranslations | null>;
  retryEnglishTranslation(id: string): Promise<CategoryWithTranslations>;
  listCategoryTranslations(id: string): Promise<CategoryTranslationListItem[]>;
  lockCategoryForTranslationEdit(id: string): Promise<number | null>;
  findCategoryLanguage(locale: string): Promise<CategoryLanguage | null>;
  findCategoryTranslation(categoryId: string, locale: string): Promise<CategoryTranslation | null>;
  findCategoryTranslationRevision(categoryId: string, locale: string): Promise<CategoryTranslationRevision | null>;
  updateCategoryTranslationIfCurrent(input: CategoryTranslationUpdate): Promise<boolean>;
  createCategoryTranslation(input: CategoryTranslationWrite): Promise<void>;
  findCategoryTranslationResponse(categoryId: string, locale: string): Promise<CategoryTranslationListItem>;
  countChildCategories(id: string): Promise<number>;
  countProductsInCategory(id: string): Promise<number>;
  deleteCategory(id: string): Promise<CategoryDeleteResult>;
  findAllCategoryLanguages(enabledOnly: boolean): Promise<CategoryLanguage[]>;
  updateCategoryLanguage(locale: string, enabled: boolean, generation: number): Promise<CategoryLanguage>;
  updateCategoryTranslationGeneration(locale: string, generation: number): Promise<void>;
  findCategorySourceVersions(): Promise<CategorySourceVersion[]>;
  updateEditorialCategoryTranslation(
    categoryId: string,
    locale: string,
    sourceVersion: number,
    enableGeneration: number,
  ): Promise<void>;
  upsertPendingCategoryTranslation(input: PendingCategoryTranslation): Promise<void>;
}

export type CategoryDataOperations = Pick<
  CategoryPersistenceOperations,
  'findCategoryId' | 'findCategoryParentId' | 'findCategoryWithTranslations' | 'updateCategoryContent'
>;

export interface CategoryImageRepository {
  findCategoryId(id: string): Promise<string | null>;
  updateCategoryImage(
    id: string,
    slot: CategoryImageSlot,
    storageKey: string | null,
  ): Promise<CategoryWithTranslations>;
}

export interface CategoryReadRepository {
  findAllCategoriesWithTranslations(): Promise<CategoryWithTranslations[]>;
}

export interface CategoryRepository extends CategoryDataOperations, CategoryImageRepository, CategoryReadRepository {
  findCategoryIdBySlug(slug: string): Promise<string | null>;
  findCategoryPage(skip: number, take: number): Promise<CategoryWithTranslations[]>;
  countCategories(): Promise<number>;
  countChildCategories(id: string): Promise<number>;
  countProductsInCategory(id: string): Promise<number>;
  deleteCategory(id: string): Promise<CategoryDeleteResult>;
  transaction<T>(work: (tx: CategoryPersistenceOperations) => Promise<T>): Promise<T>;
}

export interface CategoryTranslationRepository {
  retryEnglishTranslation(id: string): Promise<CategoryWithTranslations>;
  transaction<T>(work: (tx: CategoryPersistenceOperations) => Promise<T>): Promise<T>;
}

export interface CategoryLanguageRepository {
  findCategoryLanguage(locale: string): Promise<CategoryLanguage | null>;
  findAllCategoryLanguages(enabledOnly: boolean): Promise<CategoryLanguage[]>;
  transaction<T>(work: (tx: CategoryPersistenceOperations) => Promise<T>): Promise<T>;
}
