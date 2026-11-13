import { ApiProperty } from '@nestjs/swagger';
import { ProductResponseDto } from '#src/modules/catalog/product/dto/product-response.dto.js';
import { VariantResponseDto } from '#src/modules/catalog/product/dto/variant-response.dto.js';
import { ImageResponseDto } from '#src/modules/catalog/product/dto/image-response.dto.js';

export class ProductDetailResponseDto extends ProductResponseDto {
  @ApiProperty({
    type: [VariantResponseDto],
    description: 'Storefront: ACTIVE variants only. Back-office: every variant.',
  })
  variants: VariantResponseDto[];

  @ApiProperty({ type: [ImageResponseDto], description: 'Images grouped by color via colorId, ordered by sortOrder' })
  images: ImageResponseDto[];
}
