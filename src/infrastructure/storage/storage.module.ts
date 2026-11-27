import { Module } from '@nestjs/common';
import { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';
import { ImageStorage } from '#src/infrastructure/storage/storage.port.js';

@Module({
  providers: [CloudinaryClient, { provide: ImageStorage, useExisting: CloudinaryClient }],
  exports: [CloudinaryClient, ImageStorage],
})
export class StorageModule {}
