import { ApiProperty } from '@nestjs/swagger';
import { SALE_PRICE_STATUSES, type SalePriceStatus } from '#src/modules/catalog/pricing/sale-price-status.js';

export class SalePriceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  variantId: string;

  @ApiProperty({ description: 'Integer VND, below the Variant price', example: 159000 })
  price: number;

  @ApiProperty({ description: 'Inclusive start', format: 'date-time' })
  startsAt: Date;

  @ApiProperty({ description: 'Exclusive end', format: 'date-time' })
  endsAt: Date;

  @ApiProperty({ enum: SALE_PRICE_STATUSES, enumName: 'SalePriceStatus', description: 'At request time' })
  status: SalePriceStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
