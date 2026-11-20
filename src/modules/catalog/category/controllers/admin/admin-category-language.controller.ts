import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/security/authorization/permissions/authorize.decorator.js';
import { Permission } from '#src/security/contracts/permission.enum.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { CategoryLanguageService } from '#src/modules/catalog/category/services/shared/category-language.service.js';
import { UpdateCategoryLanguageDto } from '#src/modules/catalog/category/dto/admin/category-language.dto.js';

@ApiTags(API_TAGS.ADMIN_CATEGORIES.name)
@Authorize(Permission.CATALOG_CATEGORY_VIEW)
@Controller('admin/languages')
export class AdminCategoryLanguageController {
  constructor(private readonly languages: CategoryLanguageService) {}

  @Get()
  @ApiOperation({ summary: 'List category content languages (STAFF/ADMIN)' })
  @ApiOkResponse({ description: 'Category languages' })
  @ApiErrorResponses(401, 403)
  list() {
    return this.languages.findAll();
  }

  @Patch(':locale')
  @Authorize(Permission.CATALOG_CATEGORY_MANAGE)
  @ApiOperation({ summary: 'Enable or disable a category content language (ADMIN only)' })
  @ApiOkResponse({ description: 'Updated category language' })
  @ApiErrorResponses(400, 401, 403)
  update(@Param('locale') locale: string, @Body() dto: UpdateCategoryLanguageDto) {
    return this.languages.setEnabled(locale, dto.enabled);
  }
}
