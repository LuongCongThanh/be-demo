import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CategoriesController } from '#src/modules/catalog/category/category.controller.js';
import { AdminCategoriesController } from '#src/modules/catalog/category/admin-category.controller.js';
import { ProductsController } from '#src/modules/catalog/product/product.controller.js';
import { AdminProductsController } from '#src/modules/catalog/product/admin-product.controller.js';
import { ProductOptionsController } from '#src/modules/catalog/product-option/product-option.controller.js';
import { AdminProductOptionsController } from '#src/modules/catalog/product-option/admin-product-option.controller.js';
import { CategoryService } from '#src/modules/catalog/category/category.service.js';
import { AdminCategoryService } from '#src/modules/catalog/category/admin-category.service.js';
import { ProductService } from '#src/modules/catalog/product/product.service.js';
import { AdminProductService } from '#src/modules/catalog/product/admin-product.service.js';
import { AdminProductImageService } from '#src/modules/catalog/product/admin-product-image.service.js';
import { ProductOptionService } from '#src/modules/catalog/product-option/product-option.service.js';

@Module({
  // PassportModule cấp AuthModuleOptions cho JwtAuthGuard (@Authorize); strategy 'jwt' do IdentityModule đăng ký.
  imports: [PassportModule.register({})],
  controllers: [
    CategoriesController,
    AdminCategoriesController,
    ProductsController,
    AdminProductsController,
    ProductOptionsController,
    AdminProductOptionsController,
  ],
  providers: [
    CategoryService,
    AdminCategoryService,
    ProductService,
    AdminProductService,
    AdminProductImageService,
    ProductOptionService,
  ],
})
export class CatalogModule {}
