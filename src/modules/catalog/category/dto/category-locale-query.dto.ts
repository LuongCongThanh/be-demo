import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CATEGORY_SUPPORTED_LOCALES } from '#src/modules/catalog/category/category-locale.js';

export class CategoryLocaleQueryDto {
  @ApiPropertyOptional({ enum: [...CATEGORY_SUPPORTED_LOCALES], default: 'vi', example: 'en' })
  @IsOptional()
  @IsIn([...CATEGORY_SUPPORTED_LOCALES])
  locale?: (typeof CATEGORY_SUPPORTED_LOCALES)[number];
}
