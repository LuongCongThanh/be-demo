import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Mỗi Product có 1–5 ảnh (CONTEXT.md, Product Image).
export const MIN_PRODUCT_IMAGES = 1;
export const MAX_PRODUCT_IMAGES = 5;

// 1 phần tử trong `images[]` của POST /products — thứ tự mảng là thứ tự hiển
// thị, phần tử đầu là Cover Image (không có isPrimary/sortOrder).
export class CreateProductImageDto {
  @ApiProperty({
    description: 'Key trả về từ POST /upload-images/presign (purpose PRODUCT_IMAGE), file đã upload xong',
    example: 'tmp/product-image/550e8400-e29b-41d4-a716-446655440000.jpg',
  })
  @IsNotEmpty()
  @IsString()
  key: string;

  @ApiPropertyOptional({ maxLength: 255, example: 'Front view' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;
}
