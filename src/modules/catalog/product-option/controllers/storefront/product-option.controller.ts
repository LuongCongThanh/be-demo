import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { ProductOptionService } from '#src/modules/catalog/product-option/services/shared/product-option.service.js';
import { SizeResponseDto } from '#src/modules/catalog/product-option/dto/shared/size-response.dto.js';
import { ColorResponseDto } from '#src/modules/catalog/product-option/dto/shared/color-response.dto.js';

/** Storefront filter options — công khai, chỉ mục không ẩn. */
@ApiTags(API_TAGS.STOREFRONT_PRODUCT_OPTIONS.name)
@Controller()
export class ProductOptionController {
  constructor(private readonly service: ProductOptionService) {}

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
