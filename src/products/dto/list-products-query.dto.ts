import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';

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
}

// `?size=M` đến dạng string, `?size=M&size=L` đến dạng mảng.
function toArray(value: unknown): unknown {
  return typeof value === 'string' ? [value] : value;
}
