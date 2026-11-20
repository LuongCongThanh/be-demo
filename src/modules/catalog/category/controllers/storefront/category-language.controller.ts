import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { CategoryLanguageService } from '#src/modules/catalog/category/services/shared/category-language.service.js';

@ApiTags(API_TAGS.STOREFRONT_CATEGORIES.name)
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
