import { Module } from '@nestjs/common';
import { MomoGateway } from '#src/infrastructure/payment/momo.gateway.js';
import { VnpayGateway } from '#src/infrastructure/payment/vnpay.gateway.js';
import { PaymentGateway } from '#src/generated/prisma/enums.js';
import {
  PAYMENT_GATEWAYS,
  type PaymentGateway as PaymentGatewayContract,
} from '#src/modules/payment/payment-gateway.js';
import { PaymentController } from '#src/modules/payment/payment.controller.js';
import { PaymentsService } from '#src/modules/payment/payment.service.js';

@Module({
  controllers: [PaymentController],
  providers: [
    MomoGateway,
    VnpayGateway,
    {
      provide: PAYMENT_GATEWAYS,
      useFactory: (vnpay: VnpayGateway, momo: MomoGateway) =>
        new Map<PaymentGateway, PaymentGatewayContract>([
          [vnpay.gateway, vnpay],
          [momo.gateway, momo],
        ]),
      inject: [VnpayGateway, MomoGateway],
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentModule {}
