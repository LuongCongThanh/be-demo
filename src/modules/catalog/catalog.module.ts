import { Module } from '@nestjs/common';
import { AuthModule } from '#src/auth/auth.module.js';
import { CategoriesController } from '#src/modules/catalog/storefront/categories.controller.js';
import { AdminCategoriesController } from '#src/modules/catalog/back-office/admin-categories.controller.js';
import { ProductsController } from '#src/modules/catalog/storefront/products.controller.js';
import { AdminProductsController } from '#src/modules/catalog/back-office/admin-products.controller.js';
import { ProductOptionsController } from '#src/modules/catalog/storefront/product-options.controller.js';
import { AdminProductOptionsController } from '#src/modules/catalog/back-office/admin-product-options.controller.js';
import { CategoriesService } from '#src/modules/catalog/services/categories/categories.service.js';
import { AdminCategoriesService } from '#src/modules/catalog/services/categories/admin-categories.service.js';
import { ProductsService } from '#src/modules/catalog/services/products/products.service.js';
import { AdminProductsService } from '#src/modules/catalog/services/products/admin-products.service.js';
import { AdminProductImagesService } from '#src/modules/catalog/services/products/admin-product-images.service.js';
import { ProductOptionsService } from '#src/modules/catalog/services/product-options/product-options.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    CategoriesController,
    AdminCategoriesController,
    ProductsController,
    AdminProductsController,
    ProductOptionsController,
    AdminProductOptionsController,
  ],
  providers: [
    CategoriesService,
    AdminCategoriesService,
    ProductsService,
    AdminProductsService,
    AdminProductImagesService,
    ProductOptionsService,
  ],
})
export class CatalogModule {}
