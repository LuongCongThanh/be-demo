import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '#src/common/pagination/pagination-meta.dto.js';
import { VariantResponseDto } from '#src/modules/catalog/dto/products/variant-response.dto.js';

export class PaginatedVariantResponseDto {
  @ApiProperty({ type: [VariantResponseDto] })
  data: VariantResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
