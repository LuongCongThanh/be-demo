export const CATEGORY_TRANSLATION_WORKER_PORT = Symbol('CATEGORY_TRANSLATION_WORKER_PORT');

export interface CategoryTranslationJob {
  categoryId: string;
  locale: string;
  name: string;
  sourceVersion: number;
  revision: number;
  enableGeneration: number;
}

export interface CategoryTranslationWorkerPort {
  findEnabledLocales(): Promise<Array<{ locale: string; generation: number }>>;
  findPendingTranslations(locales: string[], at: Date, limit: number): Promise<CategoryTranslationJob[]>;
  claimTranslation(job: CategoryTranslationJob, now: Date, leaseUntil: Date): Promise<boolean>;
  markTranslationFailed(job: CategoryTranslationJob, leaseUntil: Date): Promise<boolean>;
  completeTranslation(job: CategoryTranslationJob, leaseUntil: Date, name: string): Promise<boolean>;
}
