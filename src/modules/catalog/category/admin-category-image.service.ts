import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';
import {
  CATEGORY_IMAGE_FORMATS,
  CATEGORY_IMAGE_MAX_BYTES,
  categoryImagePrefix,
  isCategoryImageKey,
} from '#src/modules/catalog/category/category-image.constants.js';
import { CategoryImageSlot } from '#src/modules/catalog/category/category-image-slot.enum.js';
import { adminCategory, categoryTranslations } from '#src/modules/catalog/category/category-response.mapper.js';

@Injectable()
export class AdminCategoryImageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CloudinaryClient,
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
        throw new BadRequestException('storageKey was not issued for this category image slot');
      const image = await this.storage.findImage(storageKey);
      if (
        !image ||
        !(CATEGORY_IMAGE_FORMATS as readonly string[]).includes(image.format) ||
        image.bytes <= 0 ||
        image.bytes > CATEGORY_IMAGE_MAX_BYTES
      ) {
        throw new UnprocessableEntityException('Upload a JPEG, PNG or WebP image of at most 5 MB first');
      }
    }
    // Never destroy the old object here: another concurrent request may reattach it.
    const data =
      slot === CategoryImageSlot.THUMBNAIL ? { thumbnailStorageKey: storageKey } : { bannerStorageKey: storageKey };
    return adminCategory(
      await this.prisma.category.update({ where: { id }, data, include: categoryTranslations }),
      this.storage,
    );
  }

  private async find(id: string) {
    const found = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`Category #${id} not found`);
    return found;
  }
}
