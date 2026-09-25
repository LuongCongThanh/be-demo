import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Không có sortOrder/isPrimary — `images` trong ProductResponseDto luôn đã
// sắp đúng thứ tự hiển thị, `images[0]` là Cover Image.
export class ImageResponseDto {
  @ApiProperty({ example: 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b' })
  id: string;

  @ApiProperty({ example: '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a' })
  productId: string;

  @ApiProperty({
    example:
      'http://localhost:9000/media/products/0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a/c73fb45a-77a1-4875-a30e-28607156e2fc.jpg',
  })
  url: string;

  @ApiPropertyOptional({ nullable: true, example: 'Mặt trước' })
  altText: string | null;

  @ApiProperty({ example: '2026-09-24T08:46:12.345Z' })
  createdAt: Date;
}
