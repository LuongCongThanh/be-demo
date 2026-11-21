import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CategoryModule } from '#src/modules/catalog/category/category.module.js';
import { StorageModule } from '#src/infrastructure/storage/storage.module.js';
import { ProductController } from '#src/modules/catalog/product/controllers/storefront/product.controller.js';
import { AdminProductController } from '#src/modules/catalog/product/controllers/admin/admin-product.controller.js';
import { ProductOptionController } from '#src/modules/catalog/product-option/controllers/storefront/product-option.controller.js';
import { AdminProductOptionController } from '#src/modules/catalog/product-option/controllers/admin/admin-product-option.controller.js';
import { ProductService } from '#src/modules/catalog/product/services/storefront/product.service.js';
import { AdminProductService } from '#src/modules/catalog/product/services/admin/admin-product.service.js';
import { AdminProductImageService } from '#src/modules/catalog/product/services/admin/admin-product-image.service.js';
import { ProductOptionService } from '#src/modules/catalog/product-option/services/shared/product-option.service.js';
import { AdminSalePriceController } from '#src/modules/catalog/pricing/controllers/admin/admin-sale-price.controller.js';
import { AdminSalePriceService } from '#src/modules/catalog/pricing/services/admin/admin-sale-price.service.js';

@Module({
  // PassportModule cấp AuthModuleOptions cho JwtAuthGuard (@Authorize); strategy 'jwt' do IdentityModule đăng ký.
  imports: [PassportModule.register({}), StorageModule, CategoryModule],
  controllers: [
    ProductController,
    AdminProductController,
    ProductOptionController,
    AdminProductOptionController,
    AdminSalePriceController,
  ],
  providers: [
    ProductService,
    AdminProductService,
    AdminProductImageService,
    ProductOptionService,
    AdminSalePriceService,
  ],
})
export class CatalogModule {}
