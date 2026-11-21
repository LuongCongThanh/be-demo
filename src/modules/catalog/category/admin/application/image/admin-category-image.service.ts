import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  CATEGORY_IMAGE_FORMATS,
  CATEGORY_IMAGE_MAX_BYTES,
  categoryImagePrefix,
  isCategoryImageKey,
} from '#src/modules/catalog/category/domain/image/category-image.constants.js';
import { CategoryImageSlot } from '#src/modules/catalog/category/domain/image/category-image-slot.enum.js';
import type { CategoryImageStorage } from '#src/modules/catalog/category/application/ports/storage/category-image.storage.js';
import { CATEGORY_IMAGE_STORAGE } from '#src/modules/catalog/category/application/ports/storage/category-image.storage.js';
import type { CategoryImageRepository } from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';
import { CATEGORY_REPOSITORY } from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';
import {
  CategoryImageUploadError,
  CategoryInvalidInputError,
  CategoryNotFoundError,
} from '#src/modules/catalog/category/domain/errors/category-errors.js';

@Injectable()
export class AdminCategoryImageService {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly repository: CategoryImageRepository,
    @Inject(CATEGORY_IMAGE_STORAGE) private readonly storage: CategoryImageStorage,
  ) {}

  async presign(id: string, slot: CategoryImageSlot) {
    await this.find(id);
    const storageKey = `${categoryImagePrefix(id, slot)}${randomUUID()}`;
    return { ...this.storage.signUpload(storageKey, CATEGORY_IMAGE_FORMATS), storageKey };
  }

  async set(id: string, slot: CategoryImageSlot, storageKey: string | null) {
    await this.find(id);
    if (storageKey !== null) {
      if (!isCategoryImageKey(id, slot, storageKey))
        throw new CategoryInvalidInputError('storageKey was not issued for this category image slot');
      const image = await this.storage.findImage(storageKey);
      if (
        !image ||
        !(CATEGORY_IMAGE_FORMATS as readonly string[]).includes(image.format) ||
        image.bytes <= 0 ||
        image.bytes > CATEGORY_IMAGE_MAX_BYTES
      ) {
        throw new CategoryImageUploadError('Upload a JPEG, PNG or WebP image of at most 5 MB first');
      }
    }
    // Never destroy the old object here: another concurrent request may reattach it.
    return this.repository.updateCategoryImage(id, slot, storageKey);
  }

  private async find(id: string) {
    const found = await this.repository.findCategoryId(id);
    if (!found) throw new CategoryNotFoundError(`Category #${id} not found`);
    return found;
  }
}
