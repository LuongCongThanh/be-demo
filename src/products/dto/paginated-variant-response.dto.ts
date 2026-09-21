import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from './pagination-meta.dto.js';
import { VariantResponseDto } from './variant-response.dto.js';

export class PaginatedVariantResponseDto {
  @ApiProperty({ type: [VariantResponseDto] })
  data: VariantResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
