import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/common/auth/authorize.decorator.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { AdminCategoriesService } from '#src/modules/catalog/services/categories/admin-categories.service.js';
import { CreateCategoryDto } from '#src/modules/catalog/dto/categories/create-category.dto.js';
import { UpdateCategoryDto } from '#src/modules/catalog/dto/categories/update-category.dto.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { CategoryResponseDto } from '#src/modules/catalog/dto/categories/category-response.dto.js';
import { PaginatedCategoryResponseDto } from '#src/modules/catalog/dto/categories/paginated-category-response.dto.js';

/** Back-office: đọc cho STAFF + ADMIN (kể cả danh mục ẩn), ghi chỉ ADMIN. */
@ApiTags(API_TAGS.CATEGORIES.name)
@Authorize('STAFF', 'ADMIN')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly service: AdminCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List every category flat, including hidden ones (paginated, STAFF/ADMIN)' })
  @ApiOkResponse({ type: PaginatedCategoryResponseDto })
  @ApiErrorResponses(400, 401, 403)
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get any category by id, including hidden ones (STAFF/ADMIN)' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Category not found'])
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Authorize('ADMIN')
  @ApiOperation({ summary: 'Create a category, optionally under a parent (ADMIN only)' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Parent category not found'], [409, 'Category name already exists'])
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Authorize('ADMIN')
  @ApiOperation({
    summary: 'Update a category: rename (new slug), move to another parent or root, reorder, hide (ADMIN only)',
  })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(
    [400, 'Invalid body or the move would create a cycle'],
    401,
    403,
    [404, 'Category or parent not found'],
    [409, 'Category name already exists'],
  )
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Authorize('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an empty leaf category (409 while it has subcategories or products, ADMIN only)' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiErrorResponses(400, 401, 403, [404, 'Category not found'], [409, 'Category still has subcategories or products'])
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
