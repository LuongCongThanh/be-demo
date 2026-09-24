import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VariantStatus } from '../../generated/prisma/enums.js';

// Tóm tắt Option Value nhúng trong variant — `code` là phần đã nằm trong SKU.
export class OptionValueSummaryDto {
  @ApiProperty({ example: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' })
  id: string;

  @ApiProperty({ example: 'Đen' })
  name: string;

  @ApiProperty({ example: 'BLK' })
  code: string;
}

export class VariantResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a' })
  productId: string;

  @ApiProperty({ description: 'Ghép từ Product Code + mã màu/size', example: 'TSB001-BLK-M' })
  sku: string;

  @ApiPropertyOptional({ type: OptionValueSummaryDto, nullable: true })
  color: OptionValueSummaryDto | null;

  @ApiPropertyOptional({ type: OptionValueSummaryDto, nullable: true })
  size: OptionValueSummaryDto | null;

  // Serialize thành string (Prisma Decimal.toJSON()) chứ không phải number —
  // giữ đúng độ chính xác thập phân, không qua vòng float trung gian.
  @ApiProperty({ example: '199000.00' })
  price: string;

  @ApiProperty({ enum: VariantStatus, example: VariantStatus.ACTIVE })
  status: VariantStatus;

  @ApiProperty({ example: '2026-09-24T08:46:12.345Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-24T08:46:12.345Z' })
  updatedAt: Date;
}
