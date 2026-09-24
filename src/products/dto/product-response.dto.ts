import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '../../generated/prisma/enums.js';
import { VariantResponseDto } from './variant-response.dto.js';
import { ImageResponseDto } from './image-response.dto.js';

export class ProductResponseDto {
  @ApiProperty({ example: '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  categoryId: string;

  @ApiProperty({ example: 'Áo thun basic' })
  name: string;

  @ApiProperty({ example: 'TSB001' })
  code: string;

  @ApiProperty({ example: 'ao-thun-basic' })
  slug: string;

  @ApiPropertyOptional({ nullable: true, example: 'Áo thun cotton 100%, form regular.' })
  description: string | null;

  @ApiProperty({ enum: ProductStatus, example: ProductStatus.ACTIVE })
  status: ProductStatus;

  @ApiProperty({ example: '2026-09-24T08:46:12.345Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-24T08:46:12.345Z' })
  updatedAt: Date;

  @ApiProperty({ type: [VariantResponseDto] })
  variants: VariantResponseDto[];

  @ApiProperty({ type: [ImageResponseDto], description: 'Theo thứ tự hiển thị — phần tử đầu là Cover Image' })
  images: ImageResponseDto[];
}
