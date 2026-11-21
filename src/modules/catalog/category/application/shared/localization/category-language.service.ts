import { Inject, Injectable } from '@nestjs/common';
import { isCategoryLocale } from '#src/modules/catalog/category/domain/localization/category-locale.js';
import { CategoryInvalidInputError } from '#src/modules/catalog/category/domain/errors/category-errors.js';
import type { CategoryLanguageRepository } from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';
import { CATEGORY_LANGUAGE_REPOSITORY } from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';

@Injectable()
export class CategoryLanguageService {
  constructor(@Inject(CATEGORY_LANGUAGE_REPOSITORY) private readonly repository: CategoryLanguageRepository) {}

  async findAll(enabledOnly = false) {
    return this.repository.findAllCategoryLanguages(enabledOnly);
  }

  async setEnabled(locale: string, enabled: boolean) {
    if (!isCategoryLocale(locale)) {
      throw new CategoryInvalidInputError(`Unsupported category locale "${locale}"`);
    }
    if (locale === 'vi') {
      if (!enabled) throw new CategoryInvalidInputError('The Vietnamese source locale cannot be disabled');
      enabled = true;
    }

    return this.repository.transaction(async (tx) => {
      await tx.acquireCategoryLanguageWriteLock();
      const current = await tx.findCategoryLanguage(locale);
      if (!current) throw new CategoryInvalidInputError(`Category locale "${locale}" is not configured`);
      if (enabled === current.enabled) return current;

      const generation = current.generation + 1;
      const language = await tx.updateCategoryLanguage(locale, enabled, generation);
      if (!enabled) {
        await tx.updateCategoryTranslationGeneration(locale, generation);
      } else {
        const categories = await tx.findCategorySourceVersions();
        await Promise.all(
          categories.map(async (category) => {
            const existing = await tx.findCategoryTranslation(category.id, locale);
            if (existing?.status === 'MANUAL' || existing?.status === 'REVIEW') {
              await tx.updateEditorialCategoryTranslation(category.id, locale, category.sourceVersion, generation);
              return;
            }
            return tx.upsertPendingCategoryTranslation({
              categoryId: category.id,
              locale,
              name: existing?.name ?? null,
              sourceVersion: category.sourceVersion,
              enableGeneration: generation,
            });
          }),
        );
      }
      return language;
    });
  }

  async assertEnabled(locale: string | undefined) {
    const resolved = locale ?? 'vi';
    if (!isCategoryLocale(resolved)) throw new CategoryInvalidInputError(`Unsupported category locale "${resolved}"`);
    const language = await this.repository.findCategoryLanguage(resolved);
    if (!language?.enabled) throw new CategoryInvalidInputError(`Category locale "${resolved}" is not enabled`);
    return resolved;
  }
}
