import { Inject, Injectable } from '@nestjs/common';
import { paginate, Paginated } from '#src/common/pagination/paginate.js';
import { toSlug } from '#src/common/utils/slug.util.js';
import {
  CategoryConflictError,
  CategoryInvalidInputError,
  CategoryNotFoundError,
  CategorySlugConflictError,
} from '#src/modules/catalog/category/domain/errors/category-errors.js';
import type { CategoryWithTranslations } from '#src/modules/catalog/category/domain/models/category.model.js';
import type {
  CategoryContentUpdate,
  CategoryDataOperations,
  CategoryRepository,
  CategoryTranslationContentChange,
} from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';
import { CATEGORY_REPOSITORY } from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';

export interface CreateCategoryInput {
  name: string;
  nameEn?: string | null;
  description?: string;
  parentId?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  nameEn?: string | null;
  description?: string;
  parentId?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
}

/**
 * Back-office danh mục (STAFF đọc, ADMIN ghi). Cây nhiều cấp với hai bất biến
 * (ADR 0001): không có vòng lặp, và không xoá được danh mục còn con hoặc còn
 * sản phẩm. Service kiểm tra trước để trả lỗi rõ ràng; FK RESTRICT ở DB là
 * lưới an toàn.
 */
@Injectable()
export class AdminCategoryService {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly repository: CategoryRepository) {}

  async create(dto: CreateCategoryInput): Promise<CategoryWithTranslations> {
    if (dto.parentId) await this.assertExists(dto.parentId, 'Parent category');
    const slug = await this.uniqueSlug(dto.name);

    const { nameEn, ...input } = dto;
    try {
      return await this.repository.transaction(async (tx) => {
        await tx.acquireCategoryLanguageWriteLock();
        const enabledLocales = await tx.findEnabledCategoryLanguages();
        const locales = new Map<string, number>([['en', 0]]);
        for (const language of enabledLocales) {
          if (language.locale !== 'vi') locales.set(language.locale, language.generation);
        }
        const translations = [...locales].map(([locale, enableGeneration]) => ({
          locale,
          name: locale === 'en' ? (nameEn ?? null) : null,
          status: locale === 'en' && nameEn ? ('MANUAL' as const) : ('PENDING' as const),
          enableGeneration,
        }));
        return tx.createCategory({ ...input, slug, translations });
      });
    } catch (error) {
      if (error instanceof CategorySlugConflictError) {
        throw new CategoryConflictError(`Category name "${dto.name}" already exists`);
      }
      throw error;
    }
  }

  findAll({ page, limit }: { page: number; limit: number }): Promise<Paginated<CategoryWithTranslations>> {
    return paginate(
      page,
      limit,
      ({ skip, take }) => this.repository.findCategoryPage(skip, take),
      () => this.repository.countCategories(),
    );
  }

  async findOne(id: string, db: CategoryDataOperations = this.repository): Promise<CategoryWithTranslations> {
    const category = await db.findCategoryWithTranslations(id);
    if (!category) {
      throw new CategoryNotFoundError(`Category #${id} not found`);
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryInput): Promise<CategoryWithTranslations> {
    if (dto.parentId === undefined) return this.updateContent(this.repository, id, dto);
    // Serialize tree moves across instances. Opposing concurrent moves must not both pass the cycle check.
    return this.repository.transaction(async (tx) => {
      await tx.acquireCategoryTreeWriteLock();
      return this.updateContent(tx, id, dto);
    });
  }

  private async updateContent(
    db: CategoryDataOperations,
    id: string,
    dto: UpdateCategoryInput,
  ): Promise<CategoryWithTranslations> {
    // Read the editorial state and revision before validating a tree move.
    const current = await this.findOne(id, db);

    if (dto.parentId) await this.assertNoCycle(id, dto.parentId, db);

    const { nameEn, ...input } = dto;
    const english = current.translations.find((translation) => translation.locale === 'en');
    if (!english) {
      throw new CategoryConflictError('Category English translation is missing — reload and retry');
    }
    const renamed = dto.name !== undefined && dto.name !== current.name;
    const updates: CategoryTranslationContentChange[] = [];
    if (nameEn !== undefined || renamed) {
      const nextSourceVersion = current.sourceVersion + (renamed ? 1 : 0);
      updates.push(
        ...current.translations.flatMap((translation): CategoryTranslationContentChange[] => {
          const translationData =
            translation.locale === 'en' && nameEn !== undefined
              ? {
                  name: nameEn,
                  status: nameEn === null ? ('PENDING' as const) : ('MANUAL' as const),
                  sourceVersion: nextSourceVersion,
                }
              : renamed
                ? translation.status === 'MANUAL' || translation.status === 'REVIEW'
                  ? { status: 'REVIEW' as const, sourceVersion: nextSourceVersion }
                  : { name: null, status: 'PENDING' as const, sourceVersion: nextSourceVersion }
                : null;
          if (!translationData) return [];
          return [
            {
              locale: translation.locale,
              expectedRevision: translation.revision,
              ...translationData,
            },
          ];
        }),
      );
    }
    // The nested write is atomic. Both source and translation revisions revoke stale edits/results.
    const update: CategoryContentUpdate = {
      id,
      expectedSourceVersion: current.sourceVersion,
      expectedEnglishRevision: english.revision,
      fields: input,
      incrementSourceVersion: renamed,
      translations: updates,
    };
    const updated = await db.updateCategoryContent(update);
    if (updated) return updated;
    await this.findOne(id, db);
    throw new CategoryConflictError('Category content changed concurrently — reload and retry');
  }

  async remove(id: string): Promise<void> {
    const [childCount, productCount] = await Promise.all([
      this.repository.countChildCategories(id),
      // Mọi trạng thái, kể cả ARCHIVED: sản phẩm không bao giờ mất danh mục.
      this.repository.countProductsInCategory(id),
    ]);
    if (childCount > 0) {
      throw new CategoryConflictError(`Category still has ${childCount} subcategory(ies) — move or delete them first`);
    }
    if (productCount > 0) {
      throw new CategoryConflictError(`Category still has ${productCount} product(s) — reassign them before deleting`);
    }

    // TOCTOU: request khác có thể gắn con/sản phẩm ngay sau pre-check — chỉ FK
    // RESTRICT (P2003) chặn được thật; dịch sang cùng lỗi 409.
    const result = await this.repository.deleteCategory(id);
    if (result === 'restricted') {
      throw new CategoryConflictError('Category still has subcategories or products — move them before deleting');
    }
  }

  /**
   * Đi ngược chuỗi tổ tiên của parent mới: gặp chính danh mục đang sửa nghĩa
   * là nó sẽ thành tổ tiên của chính mình → 400. Parent không tồn tại → 404.
   */
  private async assertNoCycle(id: string, newParentId: string, db: CategoryDataOperations): Promise<void> {
    if (newParentId === id) {
      throw new CategoryInvalidInputError('A category cannot be its own parent');
    }
    await this.assertExists(newParentId, 'Parent category', db);

    const seen = new Set<string>();
    let cursor: string | null = newParentId;
    while (cursor) {
      if (cursor === id) {
        throw new CategoryInvalidInputError('Moving the category under its own descendant would create a cycle');
      }
      if (seen.has(cursor)) throw new CategoryInvalidInputError('The destination category tree contains a cycle');
      seen.add(cursor);
      cursor = await db.findCategoryParentId(cursor);
    }
  }

  private async assertExists(id: string, label: string, db: CategoryDataOperations = this.repository): Promise<void> {
    const found = await db.findCategoryId(id);
    if (!found) {
      throw new CategoryNotFoundError(`${label} #${id} not found`);
    }
  }

  /** Pre-check trùng tên cho message rõ ràng; unique constraint vẫn là chốt chặn thật. */
  private async uniqueSlug(name: string): Promise<string> {
    const slug = toSlug(name);
    if (!slug) throw new CategoryInvalidInputError(`Category name "${name}" does not produce a valid slug`);
    // Trùng tên (=> trùng slug) bị từ chối thẳng — không tự thêm hậu tố số.
    const existing = await this.repository.findCategoryIdBySlug(slug);
    if (existing) {
      throw new CategoryConflictError(`Category name "${name}" already exists`);
    }
    return slug;
  }
}
