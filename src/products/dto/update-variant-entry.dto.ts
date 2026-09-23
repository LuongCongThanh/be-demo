import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { UpdateVariantDto } from './update-variant.dto.js';

// 1 phần tử trong mảng `variants[]` của PATCH /products/:id — coi mảng là
// full desired state (xem docs/superpowers/specs 2026-09-18-products-and-variants-design.md):
// có `id` khớp variant thuộc đúng product này → update; không có `id` → tạo
// mới (bắt buộc `sku`+`price`, kiểm ở service vì PartialType làm cả 2 optional).
export class UpdateVariantEntryDto extends PartialType(UpdateVariantDto) {
  @ApiPropertyOptional({ description: 'Bỏ trống để tạo variant mới', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  id?: string;
}
