import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// 1 phần tử trong `images[]` của PATCH /products/:id — mảng là full desired
// state: `{ id }` giữ ảnh đang có, `{ key }` gắn Pending Upload mới, ảnh vắng
// mặt bị xoá. Đúng 1 trong 2 field `id`/`key` (kiểm ở ProductImagesService —
// class-validator không diễn đạt gọn được "xor").
export class UpdateProductImageEntryDto {
  @ApiPropertyOptional({
    description: 'Id ảnh đang có — giữ lại ảnh này',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({
    description: 'Key trả về từ POST /upload-images/presign — gắn ảnh mới',
    example: 'tmp/product-image/550e8400-e29b-41d4-a716-446655440000.jpg',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  key?: string;

  @ApiPropertyOptional({ maxLength: 255, example: 'Front view', description: 'Bỏ trống với ảnh đang có = giữ nguyên' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;
}
