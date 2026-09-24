import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VariantStatus } from '../../generated/prisma/enums.js';

// Tóm tắt Option Value nhúng trong variant — `code` là phần đã nằm trong SKU.
export class OptionValueSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Đen' })
  name: string;

  @ApiProperty({ example: 'BLK' })
  code: string;
}

export class VariantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
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

  @ApiProperty({ enum: VariantStatus })
  status: VariantStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
