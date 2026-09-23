import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { UploadImageService } from './upload-image.service.js';
import { UploadImageController } from './upload-image.controller.js';
import { OBJECT_STORAGE_SERVICE } from './object-storage/object-storage.service.js';
import { S3ObjectStorageService } from './object-storage/s3-object-storage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [UploadImageController],
  providers: [
    UploadImageService,
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
  exports: [UploadImageService],
})
export class UploadImageModule {}
