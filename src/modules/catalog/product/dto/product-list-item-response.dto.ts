import { ApiProperty } from '@nestjs/swagger';
import { ProductResponseDto } from '#src/modules/catalog/product/dto/product-response.dto.js';

/** Một dòng trong danh sách storefront: thêm khoảng giá của các biến thể ACTIVE. */
export class ProductListItemResponseDto extends ProductResponseDto {
  @ApiProperty({ description: 'Lowest price among ACTIVE variants, integer VND', example: 199000 })
  minPrice: number;

  @ApiProperty({ description: 'Highest price among ACTIVE variants, integer VND', example: 249000 })
  maxPrice: number;
}
