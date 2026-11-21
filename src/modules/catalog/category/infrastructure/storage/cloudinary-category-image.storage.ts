import { Injectable } from '@nestjs/common';
import type {
  CategoryImageStorage,
  SignedCategoryImageUpload,
  StoredCategoryImage,
} from '#src/modules/catalog/category/application/ports/storage/category-image.storage.js';
import { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';

@Injectable()
export class CloudinaryCategoryImageStorage implements CategoryImageStorage {
  constructor(private readonly cloudinary: CloudinaryClient) {}

  publicUrl(storageKey: string): string | null {
    return this.cloudinary.publicUrl(storageKey);
  }

  signUpload(storageKey: string, allowedFormats: readonly string[]): SignedCategoryImageUpload {
    return this.cloudinary.signUpload(storageKey, allowedFormats);
  }

  findImage(storageKey: string): Promise<StoredCategoryImage | null> {
    return this.cloudinary.findImage(storageKey);
  }
}
