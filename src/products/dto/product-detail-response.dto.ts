import { ApiProperty } from '@nestjs/swagger';
import { ProductResponseDto } from '#src/products/dto/product-response.dto.js';
import { VariantResponseDto } from '#src/products/dto/variant-response.dto.js';

export class ProductDetailResponseDto extends ProductResponseDto {
  @ApiProperty({
    type: [VariantResponseDto],
    description: 'Storefront: ACTIVE variants only. Back-office: every variant.',
  })
  variants: VariantResponseDto[];
}
