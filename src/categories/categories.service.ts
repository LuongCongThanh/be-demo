import { Injectable, NotFoundException } from '@nestjs/common';
import type { Category } from '#src/generated/prisma/client.js';
import { PrismaService } from '#src/prisma/prisma.service.js';
import { buildVisibleTree, isEffectivelyVisible } from '#src/categories/category-tree.js';
import { CategoryTreeNodeDto } from '#src/categories/dto/category-tree-node.dto.js';

/** Storefront (công khai): chỉ danh mục hiển thị, ẩn cha thì ẩn cả nhánh. */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async tree(): Promise<CategoryTreeNodeDto[]> {
    return buildVisibleTree(await this.prisma.category.findMany());
  }

  async findVisible(id: string): Promise<Category> {
    const all = await this.prisma.category.findMany();
    const byId = new Map(all.map((c) => [c.id, c]));
    if (!isEffectivelyVisible(id, byId)) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return byId.get(id)!;
  }
}
