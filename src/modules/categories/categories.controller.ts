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
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';
import { CategoryResponseDto } from './dto/category-response.dto.js';
import { PaginatedCategoryResponseDto } from './dto/paginated-category-response.dto.js';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new category (STORE_MANAGER/MASTER_ADMIN only)' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'List categories (paginated, public)' })
  @ApiOkResponse({ type: PaginatedCategoryResponseDto })
  findAll(@Query() pagination: PaginationDto) {
    return this.categoriesService.findAll(pagination);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Category id (UUID)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOperation({ summary: 'Get a category by id (public)' })
  @ApiOkResponse({ type: CategoryResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Category id (UUID)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a category, regenerating its slug if the name changes (STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiOkResponse({ type: CategoryResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', description: 'Category id (UUID)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete a category (blocked with 409 while any product still references it, STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
