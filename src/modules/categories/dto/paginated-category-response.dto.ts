import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from './category-response.dto.js';
import { PaginationMetaDto } from './pagination-meta.dto.js';

export class PaginatedCategoryResponseDto {
  @ApiProperty({ type: [CategoryResponseDto] })
  data: CategoryResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
