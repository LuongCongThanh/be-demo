import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { CategoryService } from '#src/modules/catalog/category/services/storefront/category.service.js';
import { CategoryLocaleQueryDto } from '#src/modules/catalog/category/dto/storefront/category-locale-query.dto.js';
import { PublicCategoryResponseDto as CategoryResponseDto } from '#src/modules/catalog/category/dto/storefront/public-category-response.dto.js';
import { CategoryTreeNodeDto } from '#src/modules/catalog/category/dto/storefront/category-tree-node.dto.js';
import { CategoryLanguageService } from '#src/modules/catalog/category/services/shared/category-language.service.js';

/** Storefront — công khai, chỉ đọc, chỉ danh mục hiển thị. */
@ApiTags(API_TAGS.STOREFRONT_CATEGORIES.name)
@Controller('categories')
export class CategoryController {
  constructor(
    private readonly categoriesService: CategoryService,
    private readonly languages: CategoryLanguageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the visible category tree for the storefront menu (public)' })
  @ApiOkResponse({ type: [CategoryTreeNodeDto] })
  @ApiErrorResponses(400)
  async tree(@Query() query: CategoryLocaleQueryDto) {
    const locale = await this.languages.assertEnabled(query.locale);
    return this.categoriesService.tree(locale);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a visible category by id (public)' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(400, [404, 'Category not found or hidden'])
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Query() query: CategoryLocaleQueryDto) {
    const locale = await this.languages.assertEnabled(query.locale);
    return this.categoriesService.findVisible(id, locale);
  }
}
