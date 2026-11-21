export type CategoryTranslationStatus = 'PENDING' | 'TRANSLATED' | 'MANUAL' | 'REVIEW' | 'FAILED';

export interface CategoryTranslation {
  categoryId: string;
  locale: string;
  name: string | null;
  status: CategoryTranslationStatus;
  sourceVersion: number;
  revision: number;
  enableGeneration: number;
  leaseUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sourceVersion: number;
  nameEn: string | null;
  translationStatus: CategoryTranslationStatus;
  translationVersion: number;
  translationLeaseUntil: Date | null;
  thumbnailStorageKey: string | null;
  bannerStorageKey: string | null;
  sortOrder: number;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CategoryWithTranslations = Category & {
  translations: CategoryTranslation[];
};

export interface CategoryLanguage {
  locale: string;
  name: string;
  enabled: boolean;
  generation: number;
  createdAt: Date;
  updatedAt: Date;
}
