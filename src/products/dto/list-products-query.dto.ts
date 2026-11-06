import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
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
}
