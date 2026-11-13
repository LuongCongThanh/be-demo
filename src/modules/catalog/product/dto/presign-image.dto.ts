import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { IMAGE_CONTENT_TYPES, IMAGE_MAX_BYTES } from '#src/modules/catalog/product/product-image.constants.js';

export class PresignImageDto {
  @ApiProperty({ enum: IMAGE_CONTENT_TYPES, example: 'image/webp' })
  @IsIn(IMAGE_CONTENT_TYPES)
  contentType: (typeof IMAGE_CONTENT_TYPES)[number];

  @ApiProperty({ description: 'File size in bytes', minimum: 1, maximum: IMAGE_MAX_BYTES, example: 524288 })
  @IsInt()
  @Min(1)
  @Max(IMAGE_MAX_BYTES)
  size: number;
}
