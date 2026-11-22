import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { CheckoutService } from '#src/modules/checkout/services/storefront/checkout.service.js';
import { CreateCheckoutQuoteDto } from '#src/modules/checkout/dto/storefront/create-checkout-quote.dto.js';
import { CheckoutQuoteResponseDto } from '#src/modules/checkout/dto/storefront/checkout-quote-response.dto.js';
import { PlaceCodOrderDto } from '#src/modules/checkout/dto/storefront/place-cod-order.dto.js';
import { PlacedOrderResponseDto } from '#src/modules/checkout/dto/storefront/placed-order-response.dto.js';
import { OptionalCustomerAuthGuard } from '#src/modules/checkout/security/optional-customer-auth.guard.js';
import { CurrentUser } from '#src/security/authentication/current-user.decorator.js';
import type { JwtPayload } from '#src/security/contracts/jwt-payload.js';

@ApiTags(API_TAGS.STOREFRONT_CHECKOUT.name)
@Controller('checkout')
@UseGuards(OptionalCustomerAuthGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('quote')
  @ApiOperation({ summary: 'Calculate a 15-minute checkout quote without reserving inventory' })
  @ApiCreatedResponse({ type: CheckoutQuoteResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Variant not found'])
  quote(@Body() dto: CreateCheckoutQuoteDto, @CurrentUser() user?: JwtPayload) {
    return this.checkoutService.quote(dto, user?.sub);
  }

  @Post('orders/COD')
  @ApiOperation({ summary: 'Place a COD order from a valid quote and decrement inventory atomically' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this placement request; reusing it with a different body returns 409',
    example: 'checkout-quote-0193e4d4-0b53-7a8b-9f2d-c2a4dcab249f',
  })
  @ApiCreatedResponse({ type: PlacedOrderResponseDto })
  @ApiErrorResponses(
    400,
    401,
    403,
    [404, 'Quote not found'],
    [409, 'Quote changed, expired, used, or COD limit exceeded'],
  )
  placeCod(
    @Body() dto: PlaceCodOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.checkoutService.placeCod(dto, idempotencyKey, user?.sub);
  }
}
