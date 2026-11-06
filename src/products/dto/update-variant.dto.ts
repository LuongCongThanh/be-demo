import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { VariantStatus } from '#src/generated/prisma/enums.js';

/**
 * Chỉ giá và trạng thái đổi được. `sku` bất biến (chặt hơn BR-CAT-03 cho tới
 * khi có module ordering); size/màu là danh tính của biến thể — đổi thì tạo
 * biến thể mới. Field lạ (kể cả `sku`) → 400 nhờ forbidNonWhitelisted.
 */
export class UpdateVariantDto {
  @ApiPropertyOptional({ description: 'Integer VND, > 0', example: 249000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  price?: number;

  @ApiPropertyOptional({ enum: VariantStatus, enumName: 'VariantStatus', example: VariantStatus.ARCHIVED })
  @IsOptional()
  @IsEnum(VariantStatus)
  status?: VariantStatus;
}
