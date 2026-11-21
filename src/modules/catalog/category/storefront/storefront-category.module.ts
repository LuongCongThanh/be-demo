import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CategoryLanguageController } from '#src/modules/catalog/category/storefront/controllers/category-language.controller.js';
import { CategoryController } from '#src/modules/catalog/category/storefront/controllers/category.controller.js';
import { CategoryService } from '#src/modules/catalog/category/storefront/application/category/category.service.js';
import { CategoryCoreModule } from '#src/modules/catalog/category/category-core.module.js';

@Module({
  imports: [PassportModule.register({}), CategoryCoreModule],
  controllers: [CategoryLanguageController, CategoryController],
  providers: [CategoryService],
})
export class StorefrontCategoryModule {}
