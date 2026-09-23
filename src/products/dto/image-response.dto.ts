import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Không có sortOrder/isPrimary — `images` trong ProductResponseDto luôn đã
// sắp đúng thứ tự hiển thị, `images[0]` là Cover Image.
export class ImageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional({ nullable: true })
  altText: string | null;

  @ApiProperty()
  createdAt: Date;
}
