import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/common/auth/authorize.decorator.js';
import { Permission } from '#src/common/auth/permission.enum.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { CategoryLanguageService } from '#src/modules/catalog/category/category-language.service.js';
import { UpdateCategoryLanguageDto } from '#src/modules/catalog/category/dto/category-language.dto.js';

@ApiTags(API_TAGS.CATEGORIES.name)
@Controller('languages')
export class CategoryLanguageController {
  constructor(private readonly languages: CategoryLanguageService) {}

  @Get()
  @ApiOperation({ summary: 'List enabled category content languages (public)' })
  @ApiOkResponse({ description: 'Enabled category languages' })
  list() {
    return this.languages.findAll(true);
  }
}

@ApiTags(API_TAGS.CATEGORIES.name)
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
