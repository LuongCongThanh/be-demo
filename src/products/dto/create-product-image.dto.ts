import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const MAX_PRODUCT_IMAGES = 10;

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
