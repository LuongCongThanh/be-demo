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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { JwtAuthGuard } from '#src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '#src/auth/guards/roles.guard.js';
import { Roles } from '#src/auth/decorators/roles.decorator.js';
import { CategoriesService } from '#src/categories/categories.service.js';
import { CreateCategoryDto } from '#src/categories/dto/create-category.dto.js';
import { UpdateCategoryDto } from '#src/categories/dto/update-category.dto.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { CategoryResponseDto } from '#src/categories/dto/category-response.dto.js';
import { PaginatedCategoryResponseDto } from '#src/categories/dto/paginated-category-response.dto.js';

@ApiTags(API_TAGS.CATEGORIES.name)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new category (STORE_MANAGER/MASTER_ADMIN only)' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(400, 401, 403, [409, 'Category name already exists'])
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'List categories (paginated, public)' })
  @ApiOkResponse({ type: PaginatedCategoryResponseDto })
  @ApiErrorResponses(400)
  findAll(@Query() pagination: PaginationDto) {
    return this.categoriesService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category by id (public)' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(400, [404, 'Category not found'])
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a category, regenerating its slug if the name changes (STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Category not found'], [409, 'Category name already exists'])
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete a category (blocked with 409 while any product still references it, STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiErrorResponses(400, 401, 403, [404, 'Category not found'], [409, 'Category still has products'])
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
