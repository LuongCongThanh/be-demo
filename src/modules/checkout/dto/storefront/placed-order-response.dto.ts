import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '#src/generated/prisma/enums.js';

export class PlacedOrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'FS2611-7K3QZD' })
  orderNumber: string;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status: OrderStatus;

  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  paymentMethod: PaymentMethod;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  discount: number;

  @ApiProperty()
  shippingFee: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  placedAt: Date;
}
