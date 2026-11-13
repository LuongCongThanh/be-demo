import { Module } from '@nestjs/common';
import { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';

@Module({
  providers: [CloudinaryClient],
  exports: [CloudinaryClient],
})
export class StorageModule {}
