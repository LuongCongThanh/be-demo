import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { ProductStatus } from '#src/generated/prisma/enums.js';

/** Back-office listing: mọi trạng thái, mới nhất trước. */
export class AdminListProductsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ProductStatus, enumName: 'ProductStatus', example: ProductStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Substring of the product name or a variant SKU, case-insensitive. Trimmed; empty means no search.',
    example: 'TSHIRT',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(100)
  q?: string;
}
