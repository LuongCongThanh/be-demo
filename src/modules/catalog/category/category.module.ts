import { Module } from '@nestjs/common';
import { AdminCategoryModule } from '#src/modules/catalog/category/admin/admin-category.module.js';
import { StorefrontCategoryModule } from '#src/modules/catalog/category/storefront/storefront-category.module.js';

@Module({
  imports: [AdminCategoryModule, StorefrontCategoryModule],
})
export class CategoryModule {}
