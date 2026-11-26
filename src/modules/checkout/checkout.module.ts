import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CheckoutController } from '#src/modules/checkout/controllers/storefront/checkout.controller.js';
import { CheckoutService } from '#src/modules/checkout/services/storefront/checkout.service.js';
import { OptionalCustomerAuthGuard } from '#src/modules/checkout/security/optional-customer-auth.guard.js';
import { PaymentModule } from '#src/modules/payment/payment.module.js';

@Module({
  imports: [PassportModule.register({}), PaymentModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, OptionalCustomerAuthGuard],
})
export class CheckoutModule {}
