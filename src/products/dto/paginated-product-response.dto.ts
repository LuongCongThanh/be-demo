import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '#src/common/pagination/pagination-meta.dto.js';
import { ProductResponseDto } from '#src/products/dto/product-response.dto.js';

export class PaginatedProductResponseDto {
  @ApiProperty({ type: [ProductResponseDto] })
  data: ProductResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
