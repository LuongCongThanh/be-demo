import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { JwtAuthGuard } from '#src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '#src/auth/guards/roles.guard.js';
import { Roles } from '#src/auth/decorators/roles.decorator.js';
import { ProductOptionsService } from '#src/product-options/product-options.service.js';
import { CreateSizeDto } from '#src/product-options/dto/create-size.dto.js';
import { UpdateSizeDto } from '#src/product-options/dto/update-size.dto.js';
import { CreateColorDto } from '#src/product-options/dto/create-color.dto.js';
import { UpdateColorDto } from '#src/product-options/dto/update-color.dto.js';
import { SizeResponseDto } from '#src/product-options/dto/size-response.dto.js';
import { ColorResponseDto } from '#src/product-options/dto/color-response.dto.js';

/** Back-office: đọc cho STAFF + ADMIN (kể cả mục ẩn), ghi chỉ ADMIN. Không có DELETE. */
@ApiTags(API_TAGS.PRODUCT_OPTIONS.name)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STAFF', 'ADMIN')
@Controller('admin')
export class AdminProductOptionsController {
  constructor(private readonly service: ProductOptionsService) {}

  @Get('sizes')
  @ApiOperation({ summary: 'List every size including hidden ones, by display order (STAFF/ADMIN)' })
  @ApiOkResponse({ type: [SizeResponseDto] })
  @ApiErrorResponses(401, 403)
  listSizes() {
    return this.service.listSizes(true);
  }

  @Post('sizes')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a size (ADMIN only)' })
  @ApiCreatedResponse({ type: SizeResponseDto })
  @ApiErrorResponses(400, 401, 403, [409, 'Size code already exists'])
  createSize(@Body() dto: CreateSizeDto) {
    return this.service.createSize(dto);
  }

  @Patch('sizes/:id')
  @Roles('ADMIN')
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
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a color with a #RRGGBB swatch (ADMIN only)' })
  @ApiCreatedResponse({ type: ColorResponseDto })
  @ApiErrorResponses(400, 401, 403, [409, 'Color code already exists'])
  createColor(@Body() dto: CreateColorDto) {
    return this.service.createColor(dto);
  }

  @Patch('colors/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Rename, recolor or hide a color; the code is immutable (ADMIN only)' })
  @ApiOkResponse({ type: ColorResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Color not found'])
  updateColor(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateColorDto) {
    return this.service.updateColor(id, dto);
  }
}
