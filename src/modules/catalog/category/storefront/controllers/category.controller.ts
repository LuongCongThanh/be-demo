import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { CategoryService } from '#src/modules/catalog/category/storefront/application/category/category.service.js';
import type { CategoryImageStorage } from '#src/modules/catalog/category/application/ports/storage/category-image.storage.js';
import { CATEGORY_IMAGE_STORAGE } from '#src/modules/catalog/category/application/ports/storage/category-image.storage.js';
import {
  publicCategory,
  publicCategoryTree,
} from '#src/modules/catalog/category/storefront/presentation/mappers/category-response.mapper.js';
import { CategoryLocaleQueryDto } from '#src/modules/catalog/category/storefront/dto/category/category-locale-query.dto.js';
import { PublicCategoryResponseDto as CategoryResponseDto } from '#src/modules/catalog/category/storefront/dto/category/public-category-response.dto.js';
import { CategoryTreeNodeDto } from '#src/modules/catalog/category/storefront/dto/category/category-tree-node.dto.js';
import { CategoryLanguageService } from '#src/modules/catalog/category/application/shared/localization/category-language.service.js';

/** Storefront — công khai, chỉ đọc, chỉ danh mục hiển thị. */
@ApiTags(API_TAGS.STOREFRONT_CATEGORIES.name)
@Controller('categories')
export class CategoryController {
  constructor(
    private readonly categoriesService: CategoryService,
    private readonly languages: CategoryLanguageService,
    @Inject(CATEGORY_IMAGE_STORAGE) private readonly storage: CategoryImageStorage,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the visible category tree for the storefront menu (public)' })
  @ApiOkResponse({ type: [CategoryTreeNodeDto] })
  @ApiErrorResponses(400)
  async tree(@Query() query: CategoryLocaleQueryDto) {
    const locale = await this.languages.assertEnabled(query.locale);
    return publicCategoryTree(await this.categoriesService.tree(), this.storage, locale);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a visible category by id (public)' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(400, [404, 'Category not found or hidden'])
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Query() query: CategoryLocaleQueryDto) {
    const locale = await this.languages.assertEnabled(query.locale);
    return publicCategory(await this.categoriesService.findVisible(id), this.storage, locale);
  }
}
