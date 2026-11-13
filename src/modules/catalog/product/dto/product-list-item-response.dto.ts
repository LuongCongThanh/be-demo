import { ApiProperty } from '@nestjs/swagger';
import { ProductResponseDto } from '#src/modules/catalog/product/dto/product-response.dto.js';

/** Một dòng trong danh sách storefront: khoảng Giá áp dụng của các Biến thể ACTIVE (BR-PRC-03). */
export class ProductListItemResponseDto extends ProductResponseDto {
  @ApiProperty({
    description: 'Lowest Effective price (sale price when active) among ACTIVE variants, integer VND',
    example: 159000,
  })
  minPrice: number;

  @ApiProperty({ description: 'Highest Effective price among ACTIVE variants, integer VND', example: 249000 })
  maxPrice: number;

  @ApiProperty({
    description: 'Lowest regular Price among ACTIVE variants; show it struck through when above minPrice',
    example: 199000,
  })
  minRegularPrice: number;

  @ApiProperty({
    description: 'Largest current discount among ACTIVE variants, whole percent rounded down; 0 when none',
    example: 20,
  })
  maxDiscountPercent: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Card image: a primary image (any color) first, else the first image; null when none',
  })
  imageUrl: string | null;
}
