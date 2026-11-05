import { Module } from '@nestjs/common';
import { AuthModule } from '#src/auth/auth.module.js';
import { ProductsService } from '#src/products/products.service.js';
import { ProductsController } from '#src/products/products.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
