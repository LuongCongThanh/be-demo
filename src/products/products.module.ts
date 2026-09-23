import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { ProductImagesService } from './product-images.service.js';
import { ProductImagesController } from './product-images.controller.js';
import { OBJECT_STORAGE_SERVICE } from './object-storage/object-storage.service.js';
import { S3ObjectStorageService } from './object-storage/s3-object-storage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController, ProductImagesController],
  providers: [
    ProductsService,
    ProductImagesService,
    {
      provide: OBJECT_STORAGE_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new S3ObjectStorageService({
          endpoint: config.getOrThrow('S3_ENDPOINT'),
          bucket: config.getOrThrow('S3_BUCKET'),
          region: config.getOrThrow('S3_REGION'),
          accessKeyId: config.getOrThrow('S3_ACCESS_KEY_ID'),
          secretAccessKey: config.getOrThrow('S3_SECRET_ACCESS_KEY'),
        }),
    },
  ],
})
export class ProductsModule {}
