import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CheckoutController } from '#src/modules/checkout/controllers/storefront/checkout.controller.js';
import { CheckoutService } from '#src/modules/checkout/services/storefront/checkout.service.js';
import { OptionalCustomerAuthGuard } from '#src/modules/checkout/security/optional-customer-auth.guard.js';

@Module({
  imports: [PassportModule.register({})],
  controllers: [CheckoutController],
  providers: [CheckoutService, OptionalCustomerAuthGuard],
})
export class CheckoutModule {}
