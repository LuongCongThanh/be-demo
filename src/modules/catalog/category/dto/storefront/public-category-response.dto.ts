import { OmitType } from '@nestjs/swagger';
import { CategoryResponseDto } from '#src/modules/catalog/category/dto/shared/category-response.dto.js';

export class PublicCategoryResponseDto extends OmitType(CategoryResponseDto, [
  'translationStatus',
  'thumbnailStorageKey',
  'bannerStorageKey',
] as const) {}
