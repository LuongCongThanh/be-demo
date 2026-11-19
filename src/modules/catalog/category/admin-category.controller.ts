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
import { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';
import { adminCategory } from '#src/modules/catalog/category/category-response.mapper.js';
import { Authorize } from '#src/common/auth/authorize.decorator.js';
import { Permission } from '#src/common/auth/permission.enum.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { AdminCategoryService } from '#src/modules/catalog/category/admin-category.service.js';
import { CreateCategoryDto } from '#src/modules/catalog/category/dto/create-category.dto.js';
import { UpdateCategoryDto } from '#src/modules/catalog/category/dto/update-category.dto.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { CategoryResponseDto } from '#src/modules/catalog/category/dto/category-response.dto.js';
import { PaginatedCategoryResponseDto } from '#src/modules/catalog/category/dto/paginated-category-response.dto.js';

/** Back-office: đọc cho STAFF + ADMIN (kể cả danh mục ẩn), ghi chỉ ADMIN. */
@ApiTags(API_TAGS.CATEGORIES.name)
@Authorize(Permission.CATALOG_CATEGORY_VIEW)
@Controller('admin/categories')
export class AdminCategoryController {
  constructor(
    private readonly service: AdminCategoryService,
    private readonly storage: CloudinaryClient,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List every category flat, including hidden ones (paginated, STAFF/ADMIN)' })
  @ApiOkResponse({ type: PaginatedCategoryResponseDto })
  @ApiErrorResponses(400, 401, 403)
  async findAll(@Query() pagination: PaginationDto) {
    const result = await this.service.findAll(pagination);
    return { ...result, data: result.data.map((c) => adminCategory(c, this.storage)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get any category by id, including hidden ones (STAFF/ADMIN)' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Category not found'])
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return adminCategory(await this.service.findOne(id), this.storage);
  }

  @Post()
  @Authorize(Permission.CATALOG_CATEGORY_MANAGE)
  @ApiOperation({ summary: 'Create a category, optionally under a parent (ADMIN only)' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Parent category not found'], [409, 'Category name already exists'])
  async create(@Body() dto: CreateCategoryDto) {
    return adminCategory(await this.service.create(dto), this.storage);
  }

  @Patch(':id')
  @Authorize(Permission.CATALOG_CATEGORY_MANAGE)
  @ApiOperation({
    summary: 'Update a category: rename (stable slug), move to another parent or root, reorder, hide (ADMIN only)',
  })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(
    [400, 'Invalid body or the move would create a cycle'],
    401,
    403,
    [404, 'Category or parent not found'],
    [409, 'Category content changed concurrently; reload and retry'],
  )
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return adminCategory(await this.service.update(id, dto), this.storage);
  }

  @Post(':id/translation/retry')
  @Authorize(Permission.CATALOG_CATEGORY_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Queue a fresh English translation, replacing an override on success (ADMIN only)' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(400, 401, 403, 404)
  async retryTranslation(@Param('id', ParseUUIDPipe) id: string) {
    return adminCategory(await this.service.retryTranslation(id), this.storage);
  }

  @Delete(':id')
  @Authorize(Permission.CATALOG_CATEGORY_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an empty leaf category (409 while it has subcategories or products, ADMIN only)' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiErrorResponses(400, 401, 403, [404, 'Category not found'], [409, 'Category still has subcategories or products'])
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
