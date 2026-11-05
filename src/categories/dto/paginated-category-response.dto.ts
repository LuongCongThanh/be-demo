import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from './category-response.dto.js';
import { PaginationMetaDto } from '../../common/pagination/pagination-meta.dto.js';

export class PaginatedCategoryResponseDto {
  @ApiProperty({ type: [CategoryResponseDto] })
  data: CategoryResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
