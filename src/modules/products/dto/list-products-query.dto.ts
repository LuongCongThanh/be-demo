import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ProductStatus } from '../../../generated/prisma/enums.js';
import { PaginationDto } from './pagination.dto.js';
import { VariantVisibilityQueryDto } from './variant-visibility-query.dto.js';

export class ListProductsQueryDto extends IntersectionType(PaginationDto, VariantVisibilityQueryDto) {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ProductStatus, example: ProductStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
