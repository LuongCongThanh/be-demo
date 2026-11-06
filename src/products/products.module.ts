import { Module } from '@nestjs/common';
import { AuthModule } from '#src/auth/auth.module.js';
import { ProductsService } from '#src/products/products.service.js';
import { ProductsController } from '#src/products/products.controller.js';
import { AdminProductsService } from '#src/products/admin-products.service.js';
import { AdminProductsController } from '#src/products/admin-products.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService, AdminProductsService],
})
export class ProductsModule {}
