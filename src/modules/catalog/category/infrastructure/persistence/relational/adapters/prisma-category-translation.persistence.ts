import { Prisma } from '#src/generated/prisma/client.js';
import type {
  CategoryLanguage,
  CategoryTranslation,
} from '#src/modules/catalog/category/domain/models/category.model.js';
import type {
  CategoryTranslationListItem,
  CategoryPersistenceOperations,
  CategoryTranslationUpdate,
  CategoryTranslationWrite,
  PendingCategoryTranslation,
} from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';
import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import type {
  CategoryTranslationJob,
  CategoryTranslationWorkerPort,
} from '#src/modules/catalog/category/application/ports/translation/category-translation-worker.port.js';
import { categoryTranslations } from '#src/modules/catalog/category/infrastructure/persistence/relational/queries/category-prisma-selects.js';

type PrismaCategoryClient = PrismaService | Prisma.TransactionClient;

type TranslationOperations = Pick<
  CategoryPersistenceOperations,
  | 'findEnabledCategoryLanguages'
  | 'retryEnglishTranslation'
  | 'listCategoryTranslations'
  | 'lockCategoryForTranslationEdit'
  | 'findCategoryLanguage'
  | 'findCategoryTranslation'
  | 'findCategoryTranslationRevision'
  | 'updateCategoryTranslationIfCurrent'
  | 'createCategoryTranslation'
  | 'findCategoryTranslationResponse'
  | 'findAllCategoryLanguages'
  | 'updateCategoryLanguage'
  | 'updateCategoryTranslationGeneration'
  | 'findCategorySourceVersions'
  | 'updateEditorialCategoryTranslation'
  | 'upsertPendingCategoryTranslation'
>;

const categoryTranslationResponseSelect = {
  locale: true,
  name: true,
  status: true,
  updatedAt: true,
} satisfies Prisma.CategoryTranslationSelect;

export class PrismaCategoryTranslationPersistence implements TranslationOperations, CategoryTranslationWorkerPort {
  constructor(private readonly db: PrismaCategoryClient) {}

  findEnabledCategoryLanguages() {
    return this.db.categoryLanguage.findMany({
      where: { enabled: true },
      select: { locale: true, generation: true },
    });
  }

  findEnabledLocales() {
    return this.findEnabledCategoryLanguages();
  }

  async findPendingTranslations(locales: string[], at: Date, limit: number): Promise<CategoryTranslationJob[]> {
    const translations = await this.db.categoryTranslation.findMany({
      where: {
        locale: { in: locales },
        status: 'PENDING',
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: at } }],
      },
      include: { category: { select: { name: true } } },
      orderBy: [{ createdAt: 'asc' }, { categoryId: 'asc' }],
      take: limit,
    });
    return translations.map((translation) => ({
      categoryId: translation.categoryId,
      locale: translation.locale,
      name: translation.category.name,
      sourceVersion: translation.sourceVersion,
      revision: translation.revision,
      enableGeneration: translation.enableGeneration,
    }));
  }

  async claimTranslation(job: CategoryTranslationJob, now: Date, leaseUntil: Date): Promise<boolean> {
    const result = await this.db.categoryTranslation.updateMany({
      where: {
        ...this.translationJobWhere(job),
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      },
      data: { leaseUntil },
    });
    return result.count === 1;
  }

  async markTranslationFailed(job: CategoryTranslationJob, leaseUntil: Date): Promise<boolean> {
    const result = await this.db.categoryTranslation.updateMany({
      where: { ...this.translationJobWhere(job), leaseUntil },
      data: { status: 'FAILED', leaseUntil: null },
    });
    return result.count === 1;
  }

  async completeTranslation(job: CategoryTranslationJob, leaseUntil: Date, name: string): Promise<boolean> {
    const result = await this.db.categoryTranslation.updateMany({
      where: { ...this.translationJobWhere(job), leaseUntil },
      data: { name, status: 'TRANSLATED', leaseUntil: null },
    });
    return result.count === 1;
  }

  retryEnglishTranslation(id: string) {
    return this.db.category.update({
      where: { id },
      data: {
        translations: {
          update: {
            where: { categoryId_locale: { categoryId: id, locale: 'en' } },
            data: { status: 'PENDING', revision: { increment: 1 }, leaseUntil: null },
          },
        },
      },
      include: categoryTranslations,
    });
  }

  listCategoryTranslations(id: string) {
    return this.db.categoryTranslation.findMany({
      where: { categoryId: id },
      orderBy: [{ locale: 'asc' }],
      select: categoryTranslationResponseSelect,
    });
  }

  async lockCategoryForTranslationEdit(id: string): Promise<number | null> {
    const rows = await this.db.$queryRaw<{ sourceVersion: number }[]>`
      SELECT source_version AS "sourceVersion"
      FROM categories
      WHERE id = ${id}::uuid
      FOR UPDATE
    `;
    return rows[0]?.sourceVersion ?? null;
  }

  findCategoryLanguage(locale: string): Promise<CategoryLanguage | null> {
    return this.db.categoryLanguage.findUnique({ where: { locale } });
  }

  findCategoryTranslation(categoryId: string, locale: string): Promise<CategoryTranslation | null> {
    return this.db.categoryTranslation.findUnique({ where: { categoryId_locale: { categoryId, locale } } });
  }

  findCategoryTranslationRevision(categoryId: string, locale: string) {
    return this.db.categoryTranslation.findUnique({
      where: { categoryId_locale: { categoryId, locale } },
      select: { revision: true, sourceVersion: true, enableGeneration: true },
    });
  }

  async updateCategoryTranslationIfCurrent(input: CategoryTranslationUpdate): Promise<boolean> {
    const result = await this.db.categoryTranslation.updateMany({
      where: {
        categoryId: input.categoryId,
        locale: input.locale,
        revision: input.revision,
        sourceVersion: input.sourceVersion,
        enableGeneration: input.enableGeneration,
      },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        status: input.status,
        sourceVersion: input.sourceVersion,
        revision: { increment: 1 },
        enableGeneration: input.enableGeneration,
        leaseUntil: null,
      },
    });
    return result.count === 1;
  }

  async createCategoryTranslation(input: CategoryTranslationWrite): Promise<void> {
    await this.db.categoryTranslation.create({ data: input });
  }

  findCategoryTranslationResponse(categoryId: string, locale: string): Promise<CategoryTranslationListItem> {
    return this.db.categoryTranslation.findUniqueOrThrow({
      where: { categoryId_locale: { categoryId, locale } },
      select: categoryTranslationResponseSelect,
    });
  }

  findAllCategoryLanguages(enabledOnly: boolean): Promise<CategoryLanguage[]> {
    return this.db.categoryLanguage.findMany({
      where: enabledOnly ? { enabled: true } : undefined,
      orderBy: [{ locale: 'asc' }],
    });
  }

  updateCategoryLanguage(locale: string, enabled: boolean, generation: number): Promise<CategoryLanguage> {
    return this.db.categoryLanguage.update({
      where: { locale },
      data: { enabled, generation },
    });
  }

  async updateCategoryTranslationGeneration(locale: string, generation: number): Promise<void> {
    await this.db.categoryTranslation.updateMany({
      where: { locale },
      data: { enableGeneration: generation, leaseUntil: null },
    });
  }

  findCategorySourceVersions() {
    return this.db.category.findMany({ select: { id: true, sourceVersion: true } });
  }

  async updateEditorialCategoryTranslation(
    categoryId: string,
    locale: string,
    sourceVersion: number,
    enableGeneration: number,
  ): Promise<void> {
    await this.db.categoryTranslation.update({
      where: { categoryId_locale: { categoryId, locale } },
      data: { sourceVersion, enableGeneration, leaseUntil: null },
    });
  }

  async upsertPendingCategoryTranslation(input: PendingCategoryTranslation): Promise<void> {
    await this.db.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId: input.categoryId, locale: input.locale } },
      update: {
        name: input.name,
        status: 'PENDING',
        revision: { increment: 1 },
        sourceVersion: input.sourceVersion,
        enableGeneration: input.enableGeneration,
        leaseUntil: null,
      },
      create: {
        categoryId: input.categoryId,
        locale: input.locale,
        name: input.name,
        status: 'PENDING',
        sourceVersion: input.sourceVersion,
        enableGeneration: input.enableGeneration,
      },
    });
  }

  private translationJobWhere(job: CategoryTranslationJob) {
    return {
      categoryId: job.categoryId,
      locale: job.locale,
      sourceVersion: job.sourceVersion,
      category: { sourceVersion: job.sourceVersion },
      revision: job.revision,
      enableGeneration: job.enableGeneration,
      status: 'PENDING' as const,
    };
  }
}
