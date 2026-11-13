import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/common/auth/authorize.decorator.js';
import { CurrentUser } from '#src/common/auth/current-user.decorator.js';
import type { JwtPayload } from '#src/common/auth/jwt-payload.js';
import { Permission } from '#src/common/auth/permission.enum.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { AdminSalePriceService } from '#src/modules/catalog/pricing/admin-sale-price.service.js';
import { CreateSalePriceDto } from '#src/modules/catalog/pricing/dto/create-sale-price.dto.js';
import { SalePriceResponseDto } from '#src/modules/catalog/pricing/dto/sale-price-response.dto.js';
import { UpdateSalePriceDto } from '#src/modules/catalog/pricing/dto/update-sale-price.dto.js';

const NOT_FOUND: [404, string] = [404, 'Sale price not found'];

/** Giá khuyến mãi theo Sản phẩm (US-804): đọc cần PRICING_SALE_PRICE_VIEW, ghi cần _MANAGE. */
@ApiTags(API_TAGS.SALE_PRICES.name)
@Authorize(Permission.PRICING_SALE_PRICE_VIEW)
@Controller('admin')
export class AdminSalePriceController {
  constructor(private readonly service: AdminSalePriceService) {}

  @Get('products/:productId/sale-prices')
  @ApiOperation({ summary: 'List every sale price of a product, newest start first, with its status now' })
  @ApiOkResponse({ type: [SalePriceResponseDto] })
  @ApiErrorResponses(400, 401, 403, [404, 'Product not found'])
  list(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.service.listForProduct(productId);
  }

  @Post('products/:productId/sale-prices')
  @Authorize(Permission.PRICING_SALE_PRICE_MANAGE)
  @ApiOperation({
    summary: 'Set a sale price on one or more variants of a product (all or nothing)',
    description: 'Send `price` (same amount for each variant) or `percentOff` (per variant, rounded down to the đồng).',
  })
  @ApiCreatedResponse({ type: [SalePriceResponseDto] })
  @ApiErrorResponses(400, 401, 403, [404, 'Product or variant not found'], [409, 'Overlaps another sale price'])
  create(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateSalePriceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(productId, dto, user.sub);
  }

  @Patch('sale-prices/:id')
  @Authorize(Permission.PRICING_SALE_PRICE_MANAGE)
  @ApiOperation({ summary: 'Change an upcoming sale price, or the end of an active one' })
  @ApiOkResponse({ type: SalePriceResponseDto })
  @ApiErrorResponses(400, 401, 403, NOT_FOUND, [409, 'Ended, active field locked, or overlapping'])
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSalePriceDto) {
    return this.service.update(id, dto);
  }

  @Post('sale-prices/:id/end')
  @HttpCode(200)
  @Authorize(Permission.PRICING_SALE_PRICE_MANAGE)
  @ApiOperation({ summary: 'End an active sale price now' })
  @ApiOkResponse({ type: SalePriceResponseDto })
  @ApiErrorResponses(400, 401, 403, NOT_FOUND, [409, 'Not active'])
  end(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.end(id);
  }

  @Delete('sale-prices/:id')
  @HttpCode(204)
  @Authorize(Permission.PRICING_SALE_PRICE_MANAGE)
  @ApiOperation({ summary: 'Delete an upcoming sale price' })
  @ApiNoContentResponse()
  @ApiErrorResponses(400, 401, 403, NOT_FOUND, [409, 'Already started'])
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
