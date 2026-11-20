import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CategoryTranslationClient } from '#src/modules/catalog/category/clients/category-translation.client.js';
import { CategoryTranslationService } from '#src/modules/catalog/category/services/shared/category-translation.service.js';
import { AdminCategoryImageController } from '#src/modules/catalog/category/controllers/admin/admin-category-image.controller.js';
import { AdminCategoryImageService } from '#src/modules/catalog/category/services/admin/admin-category-image.service.js';
import { StorageModule } from '#src/infrastructure/storage/storage.module.js';
import { CategoryController } from '#src/modules/catalog/category/controllers/storefront/category.controller.js';
import { AdminCategoryController } from '#src/modules/catalog/category/controllers/admin/admin-category.controller.js';
import { ProductController } from '#src/modules/catalog/product/controllers/storefront/product.controller.js';
import { AdminProductController } from '#src/modules/catalog/product/controllers/admin/admin-product.controller.js';
import { ProductOptionController } from '#src/modules/catalog/product-option/controllers/storefront/product-option.controller.js';
import { AdminProductOptionController } from '#src/modules/catalog/product-option/controllers/admin/admin-product-option.controller.js';
import { CategoryService } from '#src/modules/catalog/category/services/storefront/category.service.js';
import { AdminCategoryService } from '#src/modules/catalog/category/services/admin/admin-category.service.js';
import { ProductService } from '#src/modules/catalog/product/services/storefront/product.service.js';
import { AdminProductService } from '#src/modules/catalog/product/services/admin/admin-product.service.js';
import { AdminProductImageService } from '#src/modules/catalog/product/services/admin/admin-product-image.service.js';
import { ProductOptionService } from '#src/modules/catalog/product-option/services/shared/product-option.service.js';
import { AdminSalePriceController } from '#src/modules/catalog/pricing/controllers/admin/admin-sale-price.controller.js';
import { AdminSalePriceService } from '#src/modules/catalog/pricing/services/admin/admin-sale-price.service.js';
import { CategoryLanguageService } from '#src/modules/catalog/category/services/shared/category-language.service.js';
import { CategoryLanguageController } from '#src/modules/catalog/category/controllers/storefront/category-language.controller.js';
import { AdminCategoryLanguageController } from '#src/modules/catalog/category/controllers/admin/admin-category-language.controller.js';

@Module({
  // PassportModule cấp AuthModuleOptions cho JwtAuthGuard (@Authorize); strategy 'jwt' do IdentityModule đăng ký.
  imports: [PassportModule.register({}), StorageModule],
  controllers: [
    CategoryController,
    AdminCategoryImageController,
    AdminCategoryController,
    CategoryLanguageController,
    AdminCategoryLanguageController,
    ProductController,
    AdminProductController,
    ProductOptionController,
    AdminProductOptionController,
    AdminSalePriceController,
  ],
  providers: [
    CategoryService,
    CategoryTranslationClient,
    CategoryTranslationService,
    AdminCategoryImageService,
    AdminCategoryService,
    CategoryLanguageService,
    ProductService,
    AdminProductService,
    AdminProductImageService,
    ProductOptionService,
    AdminSalePriceService,
  ],
})
export class CatalogModule {}
