import { Body, Controller, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/security/authorization/permissions/authorize.decorator.js';
import { Permission } from '#src/security/contracts/permission.enum.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { AdminCategoryImageService } from '#src/modules/catalog/category/services/admin/admin-category-image.service.js';
import { CategoryImageSlot } from '#src/modules/catalog/category/domain/category-image-slot.enum.js';
import {
  PresignCategoryImageDto,
  SetCategoryImageDto,
} from '#src/modules/catalog/category/dto/admin/category-image.dto.js';
import { CategoryResponseDto } from '#src/modules/catalog/category/dto/shared/category-response.dto.js';
import { PresignedImageUploadResponseDto } from '#src/modules/catalog/product/dto/admin/presigned-image-upload-response.dto.js';

@ApiTags(API_TAGS.ADMIN_CATEGORIES.name)
@Authorize(Permission.CATALOG_CATEGORY_MANAGE)
@Controller('admin/categories/:id/images/:slot')
export class AdminCategoryImageController {
  constructor(private readonly images: AdminCategoryImageService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Sign a thumbnail or banner upload (ADMIN only)' })
  @ApiCreatedResponse({ type: PresignedImageUploadResponseDto })
  @ApiErrorResponses(400, 401, 403, 404, 503)
  presign(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slot', new ParseEnumPipe(CategoryImageSlot)) slot: CategoryImageSlot,
    @Body() _dto: PresignCategoryImageDto,
  ) {
    return this.images.presign(id, slot);
  }

  @Patch()
  @ApiOperation({ summary: 'Attach an uploaded category image, or clear it with null (ADMIN only)' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(400, 401, 403, 404, 422, 503)
  set(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slot', new ParseEnumPipe(CategoryImageSlot)) slot: CategoryImageSlot,
    @Body() dto: SetCategoryImageDto,
  ) {
    return this.images.set(id, slot, dto.storageKey);
  }
}
