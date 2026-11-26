import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaymentGateway } from '#src/generated/prisma/enums.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { PaymentsService } from '#src/modules/payment/payment.service.js';

@ApiTags(API_TAGS.STOREFRONT_PAYMENTS.name)
@Controller({ path: 'payments', version: '1' })
export class PaymentController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('webhooks/vnpay')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @ApiExcludeEndpoint()
  async vnpayNotification(@Query() payload: Record<string, string>) {
    await this.paymentsService.handleNotification(PaymentGateway.VNPAY, payload);
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  @Post('webhooks/momo')
  @HttpCode(200)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @ApiExcludeEndpoint()
  async momoNotification(@Body() payload: unknown) {
    await this.paymentsService.handleNotification(PaymentGateway.MOMO, payload);
    return { resultCode: 0, message: 'success' };
  }
}
