import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { StorageModule } from '#src/infrastructure/storage/storage.module.js';
import { CategoryController } from '#src/modules/catalog/category/category.controller.js';
import { AdminCategoryController } from '#src/modules/catalog/category/admin-category.controller.js';
import { ProductController } from '#src/modules/catalog/product/product.controller.js';
import { AdminProductController } from '#src/modules/catalog/product/admin-product.controller.js';
import { ProductOptionController } from '#src/modules/catalog/product-option/product-option.controller.js';
import { AdminProductOptionController } from '#src/modules/catalog/product-option/admin-product-option.controller.js';
import { CategoryService } from '#src/modules/catalog/category/category.service.js';
import { AdminCategoryService } from '#src/modules/catalog/category/admin-category.service.js';
import { ProductService } from '#src/modules/catalog/product/product.service.js';
import { AdminProductService } from '#src/modules/catalog/product/admin-product.service.js';
import { AdminProductImageService } from '#src/modules/catalog/product/admin-product-image.service.js';
import { ProductOptionService } from '#src/modules/catalog/product-option/product-option.service.js';
import { AdminSalePriceController } from '#src/modules/catalog/pricing/admin-sale-price.controller.js';
import { AdminSalePriceService } from '#src/modules/catalog/pricing/admin-sale-price.service.js';

@Module({
  // PassportModule cấp AuthModuleOptions cho JwtAuthGuard (@Authorize); strategy 'jwt' do IdentityModule đăng ký.
  imports: [PassportModule.register({}), StorageModule],
  controllers: [
    CategoryController,
    AdminCategoryController,
    ProductController,
    AdminProductController,
    ProductOptionController,
    AdminProductOptionController,
    AdminSalePriceController,
  ],
  providers: [
    CategoryService,
    AdminCategoryService,
    ProductService,
    AdminProductService,
    AdminProductImageService,
    ProductOptionService,
    AdminSalePriceService,
  ],
})
export class CatalogModule {}
