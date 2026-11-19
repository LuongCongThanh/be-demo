import { Injectable, NotFoundException } from '@nestjs/common';
import { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';
import { categoryContent, publicCategory } from '#src/modules/catalog/category/category-response.mapper.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { buildVisibleTree, isEffectivelyVisible } from '#src/modules/catalog/category/category-tree.js';
import { CategoryTreeNodeDto } from '#src/modules/catalog/category/dto/category-tree-node.dto.js';

/** Storefront (công khai): chỉ danh mục hiển thị, ẩn cha thì ẩn cả nhánh. */
@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CloudinaryClient,
  ) {}

  async tree(locale: 'vi' | 'en' = 'vi'): Promise<CategoryTreeNodeDto[]> {
    return buildVisibleTree(await this.prisma.category.findMany(), (c) => categoryContent(c, this.storage, locale));
  }

  async findVisible(id: string, locale: 'vi' | 'en' = 'vi') {
    const all = await this.prisma.category.findMany();
    const byId = new Map(all.map((c) => [c.id, c]));
    if (!isEffectivelyVisible(id, byId)) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return publicCategory(byId.get(id)!, this.storage, locale);
  }
}
