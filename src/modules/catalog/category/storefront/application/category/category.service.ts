import { Inject, Injectable } from '@nestjs/common';
import type { CategoryReadRepository } from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';
import { CATEGORY_REPOSITORY } from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';
import type { CategoryWithTranslations } from '#src/modules/catalog/category/domain/models/category.model.js';
import { buildVisibleTree, isEffectivelyVisible } from '#src/modules/catalog/category/domain/tree/category-tree.js';
import type { CategoryTreeNode } from '#src/modules/catalog/category/domain/tree/category-tree.js';
import { CategoryNotFoundError } from '#src/modules/catalog/category/domain/errors/category-errors.js';

@Injectable()
export class CategoryService {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly repository: CategoryReadRepository) {}

  async tree(): Promise<CategoryTreeNode<CategoryWithTranslations>[]> {
    return buildVisibleTree(await this.repository.findAllCategoriesWithTranslations());
  }

  async findVisible(id: string): Promise<CategoryWithTranslations> {
    const all = await this.repository.findAllCategoriesWithTranslations();
    const byId = new Map(all.map((c) => [c.id, c]));
    if (!isEffectivelyVisible(id, byId)) {
      throw new CategoryNotFoundError(`Category #${id} not found`);
    }
    const category = byId.get(id);
    if (!category) throw new CategoryNotFoundError(`Category #${id} not found`);
    return category;
  }
}
