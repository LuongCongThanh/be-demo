import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '#src/common/pagination/pagination-meta.dto.js';
import { ProductListItemResponseDto } from '#src/modules/catalog/product/dto/product-list-item-response.dto.js';

export class PaginatedProductListResponseDto {
  @ApiProperty({ type: [ProductListItemResponseDto] })
  data: ProductListItemResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
