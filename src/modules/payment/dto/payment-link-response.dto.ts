import { ApiProperty } from '@nestjs/swagger';
import { PaymentGateway } from '#src/generated/prisma/enums.js';

export class PaymentLinkResponseDto {
  @ApiProperty()
  paymentId: string;

  @ApiProperty({ enum: PaymentGateway, enumName: 'PaymentGateway' })
  gateway: PaymentGateway;

  @ApiProperty()
  paymentUrl: string;

  @ApiProperty()
  expiresAt: Date;
}
