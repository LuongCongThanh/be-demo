import { ApiProperty } from '@nestjs/swagger';
import { PaymentGateway } from '#src/generated/prisma/enums.js';
import { IsEnum, IsUUID } from 'class-validator';

export class CreatePaymentAttemptDto {
  @ApiProperty({ example: '0193e4d4-0b53-7a8b-9f2d-c2a4dcab249f' })
  @IsUUID()
  quoteId: string;

  @ApiProperty({ enum: PaymentGateway, enumName: 'PaymentGateway', example: PaymentGateway.VNPAY })
  @IsEnum(PaymentGateway)
  gateway: PaymentGateway;
}
