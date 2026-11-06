import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from '#src/modules/catalog/dto/categories/category-response.dto.js';
import { PaginationMetaDto } from '#src/common/pagination/pagination-meta.dto.js';

export class PaginatedCategoryResponseDto {
  @ApiProperty({ type: [CategoryResponseDto] })
  data: CategoryResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
