import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { UploadImageModule } from '../upload-image/upload-image.module.js';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { ProductImagesService } from './product-images.service.js';
import { ProductVariantsService } from './product-variants.service.js';

@Module({
  imports: [AuthModule, UploadImageModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductImagesService, ProductVariantsService],
})
export class ProductsModule {}
