import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { UpdateVariantDto } from './update-variant.dto.js';

// 1 phần tử trong `variants[]` của PATCH /products/:id — mảng là full desired
// state: có `id` → sửa `price`/`status` của variant đó; không `id` → tạo mới
// (bắt buộc `price`, chọn `colorId`/`sizeId`). Gửi `colorId`/`sizeId` kèm
// `id` → 400, kiểm ở service (Option Value của variant không đổi được).
export class UpdateVariantEntryDto extends UpdateVariantDto {
  @ApiPropertyOptional({ description: 'Bỏ trống để tạo variant mới', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({
    description: 'Chỉ cho variant mới — Option Value loại COLOR',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  colorId?: string;

  @ApiPropertyOptional({
    description: 'Chỉ cho variant mới — Option Value loại SIZE',
    example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  })
  @IsOptional()
  @IsUUID()
  sizeId?: string;
}
