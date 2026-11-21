import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, Min, ValidateIf } from 'class-validator';
import { CATEGORY_IMAGE_MAX_BYTES } from '#src/modules/catalog/category/domain/image/category-image.constants.js';

export class PresignCategoryImageDto {
  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'], example: 'image/webp' })
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string;

  @ApiProperty({ minimum: 1, maximum: CATEGORY_IMAGE_MAX_BYTES, example: 524288 })
  @IsInt()
  @Min(1)
  @Max(CATEGORY_IMAGE_MAX_BYTES)
  size: number;
}

export class SetCategoryImageDto {
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'categories/550e8400-e29b-41d4-a716-446655440000/banner/550e8400-e29b-41d4-a716-446655440001',
    description: 'Uploaded key from presign, or null to remove the image',
  })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  storageKey: string | null;
}
