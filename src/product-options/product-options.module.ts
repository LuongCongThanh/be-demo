import { Module } from '@nestjs/common';
import { AuthModule } from '#src/auth/auth.module.js';
import { ProductOptionsService } from '#src/product-options/product-options.service.js';
import { ProductOptionsController } from '#src/product-options/product-options.controller.js';
import { AdminProductOptionsController } from '#src/product-options/admin-product-options.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [ProductOptionsController, AdminProductOptionsController],
  providers: [ProductOptionsService],
})
export class ProductOptionsModule {}
