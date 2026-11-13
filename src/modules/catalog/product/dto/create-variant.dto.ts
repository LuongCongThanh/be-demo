import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

import { SKU_PATTERN } from '#src/modules/catalog/product/product.constants.js';

export class CreateVariantDto {
  @ApiProperty({
    maxLength: 100,
    pattern: SKU_PATTERN.source,
    description: 'Uppercase letters, digits and hyphens; globally unique and immutable after creation',
    example: 'TSHIRT-BASIC-WHT-M',
  })
  @IsString()
  @MaxLength(100)
  // Cùng regex với CHECK trong DB (BR-CAT-03).
  @Matches(SKU_PATTERN, { message: 'sku must contain only uppercase letters, digits and hyphens' })
  sku!: string;

  @ApiProperty({
    description: 'A size from the shared size list (not hidden)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  sizeId!: string;

  @ApiProperty({
    description: 'A color from the shared palette (not hidden)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  colorId!: string;

  @ApiProperty({ description: 'Integer VND, > 0 (BR-CAT-04)', example: 199000 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  price!: number;

  // Không có `productId` — lấy từ path param `:id`.
}
