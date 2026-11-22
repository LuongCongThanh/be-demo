import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AdminCategoryImageController } from '#src/modules/catalog/category/admin/controllers/admin-category-image.controller.js';
import { AdminCategoryLanguageController } from '#src/modules/catalog/category/admin/controllers/admin-category-language.controller.js';
import { AdminCategoryController } from '#src/modules/catalog/category/admin/controllers/admin-category.controller.js';
import { AdminCategoryImageService } from '#src/modules/catalog/category/admin/application/image/admin-category-image.service.js';
import { AdminCategoryService } from '#src/modules/catalog/category/admin/application/category/admin-category.service.js';
import { AdminCategoryTranslationService } from '#src/modules/catalog/category/admin/application/translation/admin-category-translation.service.js';
import { CategoryCoreModule } from '#src/modules/catalog/category/category-core.module.js';

@Module({
  imports: [PassportModule.register({}), CategoryCoreModule],
  controllers: [AdminCategoryImageController, AdminCategoryLanguageController, AdminCategoryController],
  providers: [AdminCategoryImageService, AdminCategoryService, AdminCategoryTranslationService],
})
export class AdminCategoryModule {}
