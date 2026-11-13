import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';

export const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/**
 * Storefront listing. Không có `status` — storefront luôn chỉ thấy ACTIVE;
 * client gửi `status` sẽ bị 400 (forbidNonWhitelisted) thay vì bị bỏ qua.
 */
export class ListProductsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      'Substring of the product name, case- and Vietnamese-accent-insensitive (BR-CAT-13). Trimmed; empty means no search.',
    example: 'ao thun',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Size codes; repeat the param for several (`?size=M&size=L`)',
    example: ['M'],
  })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @ArrayMaxSize(20)
  @IsString({ each: true })
  size?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Color codes; repeat the param for several (`?color=WHT&color=BLK`)',
    example: ['WHT'],
  })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @ArrayMaxSize(20)
  @IsString({ each: true })
  color?: string[];

  @ApiPropertyOptional({ description: 'Lowest product price (integer VND) at least this', minimum: 0, example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Lowest product price (integer VND) at most this', minimum: 0, example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    enum: PRODUCT_SORTS,
    enumName: 'ProductSort',
    default: 'newest',
    description: 'Price sorts use the lowest price among ACTIVE variants',
  })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;
}

// `?size=M` đến dạng string, `?size=M&size=L` đến dạng mảng.
function toArray(value: unknown): unknown {
  return typeof value === 'string' ? [value] : value;
}
