import type { ProductImage } from '#src/generated/prisma/client.js';
import type { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';
import type { ImageResponseDto } from '#src/modules/catalog/product/dto/image-response.dto.js';

export function toImageResponse(image: ProductImage, storage: CloudinaryClient): ImageResponseDto {
  return { ...image, url: storage.publicUrl(image.storageKey) };
}
