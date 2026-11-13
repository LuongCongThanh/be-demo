import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/common/auth/authorize.decorator.js';
import { Permission } from '#src/common/auth/permission.enum.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { ProductOptionService } from '#src/modules/catalog/product-option/product-option.service.js';
import { CreateSizeDto } from '#src/modules/catalog/product-option/dto/create-size.dto.js';
import { UpdateSizeDto } from '#src/modules/catalog/product-option/dto/update-size.dto.js';
import { CreateColorDto } from '#src/modules/catalog/product-option/dto/create-color.dto.js';
import { UpdateColorDto } from '#src/modules/catalog/product-option/dto/update-color.dto.js';
import { SizeResponseDto } from '#src/modules/catalog/product-option/dto/size-response.dto.js';
import { ColorResponseDto } from '#src/modules/catalog/product-option/dto/color-response.dto.js';

/** Back-office: đọc cho STAFF + ADMIN (kể cả mục ẩn), ghi chỉ ADMIN. Không có DELETE. */
@ApiTags(API_TAGS.PRODUCT_OPTIONS.name)
@Authorize(Permission.CATALOG_PRODUCT_OPTION_VIEW)
@Controller('admin')
export class AdminProductOptionController {
  constructor(private readonly service: ProductOptionService) {}

  @Get('sizes')
  @ApiOperation({ summary: 'List every size including hidden ones, by display order (STAFF/ADMIN)' })
  @ApiOkResponse({ type: [SizeResponseDto] })
  @ApiErrorResponses(401, 403)
  listSizes() {
    return this.service.listSizes(true);
  }

  @Post('sizes')
  @Authorize(Permission.CATALOG_PRODUCT_OPTION_MANAGE)
  @ApiOperation({ summary: 'Create a size (ADMIN only)' })
  @ApiCreatedResponse({ type: SizeResponseDto })
  @ApiErrorResponses(400, 401, 403, [409, 'Size code already exists'])
  createSize(@Body() dto: CreateSizeDto) {
    return this.service.createSize(dto);
  }

  @Patch('sizes/:id')
  @Authorize(Permission.CATALOG_PRODUCT_OPTION_MANAGE)
  @ApiOperation({ summary: 'Rename, reorder or hide a size; the code is immutable (ADMIN only)' })
  @ApiOkResponse({ type: SizeResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Size not found'])
  updateSize(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSizeDto) {
    return this.service.updateSize(id, dto);
  }

  @Get('colors')
  @ApiOperation({ summary: 'List every color including hidden ones (STAFF/ADMIN)' })
  @ApiOkResponse({ type: [ColorResponseDto] })
  @ApiErrorResponses(401, 403)
  listColors() {
    return this.service.listColors(true);
  }

  @Post('colors')
  @Authorize(Permission.CATALOG_PRODUCT_OPTION_MANAGE)
  @ApiOperation({ summary: 'Create a color with a #RRGGBB swatch (ADMIN only)' })
  @ApiCreatedResponse({ type: ColorResponseDto })
  @ApiErrorResponses(400, 401, 403, [409, 'Color code already exists'])
  createColor(@Body() dto: CreateColorDto) {
    return this.service.createColor(dto);
  }

  @Patch('colors/:id')
  @Authorize(Permission.CATALOG_PRODUCT_OPTION_MANAGE)
  @ApiOperation({ summary: 'Rename, recolor or hide a color; the code is immutable (ADMIN only)' })
  @ApiOkResponse({ type: ColorResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Color not found'])
  updateColor(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateColorDto) {
    return this.service.updateColor(id, dto);
  }
}
