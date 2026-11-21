import { Injectable } from '@nestjs/common';
import { Prisma } from '#src/generated/prisma/client.js';
import { getUniqueConstraintTarget } from '#src/infrastructure/database/prisma-error.util.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import {
  CategoryNotFoundError,
  CategorySlugConflictError,
} from '#src/modules/catalog/category/domain/errors/category-errors.js';
import type {
  CategoryLanguage,
  CategoryTranslation,
} from '#src/modules/catalog/category/domain/models/category.model.js';
import type { CategoryImageSlot } from '#src/modules/catalog/category/domain/image/category-image-slot.enum.js';
import type {
  CategoryTranslationJob,
  CategoryTranslationWorkerPort,
} from '#src/modules/catalog/category/application/ports/translation/category-translation-worker.port.js';
import type {
  CategoryDeleteResult,
  CategoryTranslationListItem,
  CategoryLanguageRepository,
  CategoryPersistenceOperations,
  CategoryRepository,
  CategoryTranslationRepository,
  CategoryCreateInput,
  CategoryContentUpdate,
  CategoryTranslationUpdate,
  CategoryTranslationWrite,
  PendingCategoryTranslation,
  CategoryTranslationRevision,
} from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';
import { categoryTranslations } from '#src/modules/catalog/category/infrastructure/persistence/relational/queries/category-prisma-selects.js';
import { PrismaCategoryTranslationPersistence } from '#src/modules/catalog/category/infrastructure/persistence/relational/adapters/prisma-category-translation.persistence.js';

type PrismaCategoryClient = PrismaService | Prisma.TransactionClient;

class PrismaCategoryPersistenceOperations implements CategoryPersistenceOperations {
  private readonly translations: PrismaCategoryTranslationPersistence;

  constructor(private readonly db: PrismaCategoryClient) {
    this.translations = new PrismaCategoryTranslationPersistence(db);
  }

  async acquireCategoryLanguageWriteLock(): Promise<void> {
    await this.db.$queryRaw`SELECT pg_advisory_xact_lock(724061320)::text`;
  }

  async acquireCategoryTreeWriteLock(): Promise<void> {
    await this.db.$queryRaw`SELECT pg_advisory_xact_lock(724061319)::text`;
  }

  async findCategoryId(id: string): Promise<string | null> {
    const category = await this.db.category.findUnique({ where: { id }, select: { id: true } });
    return category?.id ?? null;
  }

  async findCategoryIdBySlug(slug: string): Promise<string | null> {
    const category = await this.db.category.findUnique({ where: { slug }, select: { id: true } });
    return category?.id ?? null;
  }

  async findCategoryParentId(id: string): Promise<string | null> {
    const category = await this.db.category.findUnique({ where: { id }, select: { parentId: true } });
    return category?.parentId ?? null;
  }

  findCategoryWithTranslations(id: string) {
    return this.db.category.findUnique({ where: { id }, include: categoryTranslations });
  }

  findAllCategoriesWithTranslations() {
    return this.db.category.findMany({ include: categoryTranslations });
  }

  findCategoryPage(skip: number, take: number) {
    return this.db.category.findMany({
      skip,
      take,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: categoryTranslations,
    });
  }

  countCategories(): Promise<number> {
    return this.db.category.count();
  }

  findEnabledCategoryLanguages() {
    return this.translations.findEnabledCategoryLanguages();
  }

  async createCategory(input: CategoryCreateInput) {
    try {
      const { translations, ...fields } = input;
      return await this.db.category.create({
        data: {
          ...fields,
          translations: {
            create: translations.length === 1 ? translations[0] : translations,
          },
        },
        include: categoryTranslations,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        getUniqueConstraintTarget(error)?.includes('slug')
      ) {
        throw new CategorySlugConflictError();
      }
      throw error;
    }
  }

  async updateCategoryContent(input: CategoryContentUpdate) {
    const data: Prisma.CategoryUncheckedUpdateInput = { ...input.fields };
    if (input.incrementSourceVersion) data.sourceVersion = { increment: 1 };
    if (input.translations.length > 0) {
      data.translations = {
        update: input.translations.map((translation) => ({
          where: {
            categoryId_locale: { categoryId: input.id, locale: translation.locale },
            revision: translation.expectedRevision,
          },
          data: {
            ...(translation.name === undefined ? {} : { name: translation.name }),
            status: translation.status,
            sourceVersion: translation.sourceVersion,
            revision: { increment: 1 },
            leaseUntil: null,
          },
        })),
      };
    }

    try {
      return await this.db.category.update({
        where: {
          id: input.id,
          sourceVersion: input.expectedSourceVersion,
          translations: { some: { locale: 'en', revision: input.expectedEnglishRevision } },
        },
        data,
        include: categoryTranslations,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return null;
      throw error;
    }
  }

  retryEnglishTranslation(id: string) {
    return this.translations.retryEnglishTranslation(id);
  }

  listCategoryTranslations(id: string) {
    return this.translations.listCategoryTranslations(id);
  }

  async lockCategoryForTranslationEdit(id: string): Promise<number | null> {
    return this.translations.lockCategoryForTranslationEdit(id);
  }

  findCategoryLanguage(locale: string): Promise<CategoryLanguage | null> {
    return this.translations.findCategoryLanguage(locale);
  }

  findCategoryTranslation(categoryId: string, locale: string): Promise<CategoryTranslation | null> {
    return this.translations.findCategoryTranslation(categoryId, locale);
  }

  findCategoryTranslationRevision(categoryId: string, locale: string): Promise<CategoryTranslationRevision | null> {
    return this.translations.findCategoryTranslationRevision(categoryId, locale);
  }

  updateCategoryTranslationIfCurrent(input: CategoryTranslationUpdate): Promise<boolean> {
    return this.translations.updateCategoryTranslationIfCurrent(input);
  }

  createCategoryTranslation(input: CategoryTranslationWrite): Promise<void> {
    return this.translations.createCategoryTranslation(input);
  }

  findCategoryTranslationResponse(categoryId: string, locale: string): Promise<CategoryTranslationListItem> {
    return this.translations.findCategoryTranslationResponse(categoryId, locale);
  }

  countChildCategories(id: string): Promise<number> {
    return this.db.category.count({ where: { parentId: id } });
  }

  countProductsInCategory(id: string): Promise<number> {
    return this.db.product.count({ where: { categoryId: id } });
  }

  updateCategoryImage(id: string, slot: CategoryImageSlot, storageKey: string | null) {
    const data = slot === 'thumbnail' ? { thumbnailStorageKey: storageKey } : { bannerStorageKey: storageKey };
    return this.db.category.update({ where: { id }, data, include: categoryTranslations });
  }

  findEnabledLocales() {
    return this.translations.findEnabledLocales();
  }

  findPendingTranslations(locales: string[], at: Date, limit: number): Promise<CategoryTranslationJob[]> {
    return this.translations.findPendingTranslations(locales, at, limit);
  }

  claimTranslation(job: CategoryTranslationJob, now: Date, leaseUntil: Date): Promise<boolean> {
    return this.translations.claimTranslation(job, now, leaseUntil);
  }

  markTranslationFailed(job: CategoryTranslationJob, leaseUntil: Date): Promise<boolean> {
    return this.translations.markTranslationFailed(job, leaseUntil);
  }

  completeTranslation(job: CategoryTranslationJob, leaseUntil: Date, name: string): Promise<boolean> {
    return this.translations.completeTranslation(job, leaseUntil, name);
  }

  async deleteCategory(id: string): Promise<CategoryDeleteResult> {
    try {
      await this.db.category.delete({ where: { id } });
      return 'deleted';
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') return 'restricted';
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new CategoryNotFoundError(`Category #${id} not found`);
      }
      throw error;
    }
  }

  findAllCategoryLanguages(enabledOnly: boolean) {
    return this.translations.findAllCategoryLanguages(enabledOnly);
  }

  updateCategoryLanguage(locale: string, enabled: boolean, generation: number) {
    return this.translations.updateCategoryLanguage(locale, enabled, generation);
  }

  updateCategoryTranslationGeneration(locale: string, generation: number): Promise<void> {
    return this.translations.updateCategoryTranslationGeneration(locale, generation);
  }

  findCategorySourceVersions() {
    return this.translations.findCategorySourceVersions();
  }

  async updateEditorialCategoryTranslation(
    categoryId: string,
    locale: string,
    sourceVersion: number,
    enableGeneration: number,
  ): Promise<void> {
    return this.translations.updateEditorialCategoryTranslation(categoryId, locale, sourceVersion, enableGeneration);
  }

  upsertPendingCategoryTranslation(input: PendingCategoryTranslation): Promise<void> {
    return this.translations.upsertPendingCategoryTranslation(input);
  }
}

@Injectable()
export class PrismaCategoryRepository
  extends PrismaCategoryPersistenceOperations
  implements
    CategoryRepository,
    CategoryTranslationRepository,
    CategoryLanguageRepository,
    CategoryTranslationWorkerPort
{
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  transaction<T>(work: (tx: CategoryPersistenceOperations) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(new PrismaCategoryPersistenceOperations(tx)));
  }
}
