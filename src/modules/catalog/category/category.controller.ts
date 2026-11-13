import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { CategoryService } from '#src/modules/catalog/category/category.service.js';
import { CategoryResponseDto } from '#src/modules/catalog/category/dto/category-response.dto.js';
import { CategoryTreeNodeDto } from '#src/modules/catalog/category/dto/category-tree-node.dto.js';

/** Storefront — công khai, chỉ đọc, chỉ danh mục hiển thị. */
@ApiTags(API_TAGS.CATEGORIES.name)
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoriesService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get the visible category tree for the storefront menu (public)' })
  @ApiOkResponse({ type: [CategoryTreeNodeDto] })
  tree() {
    return this.categoriesService.tree();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a visible category by id (public)' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(400, [404, 'Category not found or hidden'])
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findVisible(id);
  }
}
