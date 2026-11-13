import { ApiProperty } from '@nestjs/swagger';
import { ImageResponseDto } from '#src/modules/catalog/product/dto/image-response.dto.js';
import { ProductResponseDto } from '#src/modules/catalog/product/dto/product-response.dto.js';
import { VariantResponseDto } from '#src/modules/catalog/product/dto/variant-response.dto.js';

/** Giá khuyến mãi đang hiệu lực của một Biến thể. */
export class ActiveSalePriceDto {
  @ApiProperty({ description: 'Integer VND', example: 159000 })
  price: number;

  @ApiProperty({ description: 'Exclusive end', format: 'date-time' })
  endsAt: Date;
}

/** Biến thể trên storefront: kèm Giá áp dụng (BR-PRC-03). `price` vẫn là Giá bán. */
export class StorefrontVariantResponseDto extends VariantResponseDto {
  @ApiProperty({ description: 'Sale price when one is active, else price; integer VND', example: 159000 })
  effectivePrice: number;

  @ApiProperty({ type: ActiveSalePriceDto, nullable: true, description: 'Active sale price, null when none' })
  salePrice: ActiveSalePriceDto | null;
}

export class StorefrontProductDetailResponseDto extends ProductResponseDto {
  @ApiProperty({ type: [StorefrontVariantResponseDto], description: 'ACTIVE variants only' })
  variants: StorefrontVariantResponseDto[];

  @ApiProperty({ type: [ImageResponseDto], description: 'Images grouped by color via colorId, ordered by sortOrder' })
  images: ImageResponseDto[];
}
