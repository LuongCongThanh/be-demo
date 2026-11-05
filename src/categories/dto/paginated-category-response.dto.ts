import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from '#src/categories/dto/category-response.dto.js';
import { PaginationMetaDto } from '#src/common/pagination/pagination-meta.dto.js';

export class PaginatedCategoryResponseDto {
  @ApiProperty({ type: [CategoryResponseDto] })
  data: CategoryResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
