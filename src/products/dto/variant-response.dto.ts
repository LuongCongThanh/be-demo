import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VariantStatus } from '../../generated/prisma/enums.js';

export class VariantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  sku: string;

  @ApiPropertyOptional({ nullable: true })
  color: string | null;

  @ApiPropertyOptional({ nullable: true })
  size: string | null;

  // Serialize thành string (Prisma Decimal.toJSON()) chứ không phải number —
  // giữ đúng độ chính xác thập phân, không qua vòng float trung gian.
  @ApiProperty({ example: '199000.00' })
  price: string;

  @ApiProperty({ enum: VariantStatus })
  status: VariantStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
