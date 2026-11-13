import { Injectable, NotFoundException } from '@nestjs/common';
import type { Category } from '#src/generated/prisma/client.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { buildVisibleTree, isEffectivelyVisible } from '#src/modules/catalog/category/category-tree.js';
import { CategoryTreeNodeDto } from '#src/modules/catalog/category/dto/category-tree-node.dto.js';

/** Storefront (công khai): chỉ danh mục hiển thị, ẩn cha thì ẩn cả nhánh. */
@Injectable()
export class CategoryService {
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
