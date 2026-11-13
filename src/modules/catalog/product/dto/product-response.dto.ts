import { ApiProperty } from '@nestjs/swagger';
import { Gender, ProductStatus } from '#src/generated/prisma/enums.js';

export class ProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  categoryId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ description: 'Shipping weight in grams' })
  weightGrams: number;

  @ApiProperty({ enum: Gender, enumName: 'Gender' })
  gender: Gender;

  @ApiProperty({ enum: ProductStatus, enumName: 'ProductStatus' })
  status: ProductStatus;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'First time the product became ACTIVE',
  })
  publishedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
