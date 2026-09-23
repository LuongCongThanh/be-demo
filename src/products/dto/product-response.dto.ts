import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '../../generated/prisma/enums.js';
import { VariantResponseDto } from './variant-response.dto.js';
import { ImageResponseDto } from './image-response.dto.js';

export class ProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  categoryId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: ProductStatus })
  status: ProductStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [VariantResponseDto] })
  variants: VariantResponseDto[];

  @ApiProperty({ type: [ImageResponseDto] })
  images: ImageResponseDto[];
}
