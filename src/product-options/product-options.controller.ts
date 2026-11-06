import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { ProductOptionsService } from '#src/product-options/product-options.service.js';
import { SizeResponseDto } from '#src/product-options/dto/size-response.dto.js';
import { ColorResponseDto } from '#src/product-options/dto/color-response.dto.js';

/** Storefront filter options — công khai, chỉ mục không ẩn. */
@ApiTags(API_TAGS.PRODUCT_OPTIONS.name)
@Controller()
export class ProductOptionsController {
  constructor(private readonly service: ProductOptionsService) {}

  @Get('sizes')
  @ApiOperation({ summary: 'List visible sizes for storefront filters (public)' })
  @ApiOkResponse({ type: [SizeResponseDto] })
  listSizes() {
    return this.service.listSizes(false);
  }

  @Get('colors')
  @ApiOperation({ summary: 'List visible colors for storefront filters and swatches (public)' })
  @ApiOkResponse({ type: [ColorResponseDto] })
  listColors() {
    return this.service.listColors(false);
  }
}
