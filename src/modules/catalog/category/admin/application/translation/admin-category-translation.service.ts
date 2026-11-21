import { Inject, Injectable } from '@nestjs/common';
import {
  CategoryConflictError,
  CategoryInvalidInputError,
  CategoryNotFoundError,
} from '#src/modules/catalog/category/domain/errors/category-errors.js';
import { isCategoryLocale } from '#src/modules/catalog/category/domain/localization/category-locale.js';
import type {
  CategoryTranslationOperations,
  CategoryTranslationRepository,
} from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';
import { CATEGORY_TRANSLATION_REPOSITORY } from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';

@Injectable()
export class AdminCategoryTranslationService {
  constructor(@Inject(CATEGORY_TRANSLATION_REPOSITORY) private readonly repository: CategoryTranslationRepository) {}

  async retryTranslation(id: string) {
    return this.repository.retryEnglishTranslation(id);
  }

  async listTranslations(id: string) {
    return this.repository.transaction(async (tx) => {
      await this.lockCategoryForTranslationEdit(tx, id);
      return tx.listCategoryTranslations(id);
    });
  }

  async updateTranslation(id: string, locale: string, name: string | null) {
    this.assertEditableLocale(locale);
    return this.repository.transaction(async (tx) => {
      const { sourceVersion, generation } = await this.lockTranslationTarget(tx, id, locale);
      const existing = await tx.findCategoryTranslationRevision(id, locale);
      if (existing) {
        const updated = await tx.updateCategoryTranslationIfCurrent({
          categoryId: id,
          locale,
          revision: existing.revision,
          sourceVersion,
          enableGeneration: generation,
          name,
          status: name === null ? 'PENDING' : 'MANUAL',
        });
        if (!updated) {
          throw new CategoryConflictError('Category translation changed concurrently — reload and retry');
        }
      } else {
        await tx.createCategoryTranslation({
          categoryId: id,
          locale,
          name,
          status: name === null ? 'PENDING' : 'MANUAL',
          sourceVersion,
          enableGeneration: generation,
        });
      }
      return tx.findCategoryTranslationResponse(id, locale);
    });
  }

  async retryLocaleTranslation(id: string, locale: string) {
    this.assertEditableLocale(locale);
    return this.repository.transaction(async (tx) => {
      const { sourceVersion, generation } = await this.lockTranslationTarget(tx, id, locale);
      const existing = await tx.findCategoryTranslationRevision(id, locale);
      if (existing) {
        const updated = await tx.updateCategoryTranslationIfCurrent({
          categoryId: id,
          locale,
          revision: existing.revision,
          sourceVersion,
          enableGeneration: generation,
          status: 'PENDING',
        });
        if (!updated) {
          throw new CategoryConflictError('Category translation changed concurrently — reload and retry');
        }
      } else {
        await tx.createCategoryTranslation({
          categoryId: id,
          locale,
          name: null,
          sourceVersion,
          enableGeneration: generation,
          status: 'PENDING',
        });
      }
      return tx.findCategoryTranslationResponse(id, locale);
    });
  }

  private assertEditableLocale(locale: string): void {
    if (!isCategoryLocale(locale) || locale === 'vi') {
      throw new CategoryInvalidInputError(`Invalid category translation locale "${locale}"`);
    }
  }

  private async lockTranslationTarget(
    tx: CategoryTranslationOperations,
    id: string,
    locale: string,
  ): Promise<{ sourceVersion: number; generation: number }> {
    await tx.acquireCategoryLanguageWriteLock();
    const sourceVersion = await this.lockCategoryForTranslationEdit(tx, id);
    const language = await tx.findCategoryLanguage(locale);
    if (!language?.enabled) {
      throw new CategoryInvalidInputError(`Category locale "${locale}" is not enabled`);
    }
    return { sourceVersion, generation: language.generation };
  }

  private async lockCategoryForTranslationEdit(tx: CategoryTranslationOperations, id: string): Promise<number> {
    const sourceVersion = await tx.lockCategoryForTranslationEdit(id);
    if (sourceVersion === null) {
      throw new CategoryNotFoundError(`Category #${id} not found`);
    }
    return sourceVersion;
  }
}
