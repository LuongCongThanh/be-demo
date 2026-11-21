import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { CategoryLanguageService } from '#src/modules/catalog/category/application/shared/localization/category-language.service.js';
import { CategoryErrorMappingInterceptor } from '#src/modules/catalog/category/presentation/category-error-mapping.interceptor.js';
import { CategoryLanguageResponseDto } from '#src/modules/catalog/category/storefront/dto/category/category-language-response.dto.js';

@ApiTags(API_TAGS.STOREFRONT_CATEGORIES.name)
@UseInterceptors(CategoryErrorMappingInterceptor)
@Controller('languages')
export class CategoryLanguageController {
  constructor(private readonly languages: CategoryLanguageService) {}

  @Get()
  @ApiOperation({ summary: 'List enabled category content languages (public)' })
  @ApiOkResponse({ type: [CategoryLanguageResponseDto] })
  list() {
    return this.languages.findAll(true);
  }
}
