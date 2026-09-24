import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Áo thun' })
  name: string;

  @ApiProperty({ example: 'ao-thun' })
  slug: string;

  @ApiPropertyOptional({ nullable: true, example: 'Áo thun nam nữ các loại' })
  description: string | null;

  @ApiProperty({ example: '2026-09-24T08:46:12.345Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-24T08:46:12.345Z' })
  updatedAt: Date;
}
