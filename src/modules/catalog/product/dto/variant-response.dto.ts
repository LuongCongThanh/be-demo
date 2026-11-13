import { ApiProperty } from '@nestjs/swagger';
import { VariantStatus } from '#src/generated/prisma/enums.js';
import { ColorSummaryDto, SizeSummaryDto } from '#src/modules/catalog/product-option/dto/option-summary.dto.js';

export class VariantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  sku: string;

  @ApiProperty({ type: SizeSummaryDto })
  size: SizeSummaryDto;

  @ApiProperty({ type: ColorSummaryDto })
  color: ColorSummaryDto;

  @ApiProperty({ description: 'Integer VND', example: 199000 })
  price: number;

  @ApiProperty({ enum: VariantStatus, enumName: 'VariantStatus' })
  status: VariantStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
