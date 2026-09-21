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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { CreateVariantDto } from './dto/create-variant.dto.js';
import { UpdateVariantDto } from './dto/update-variant.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product (STORE_MANAGER/MASTER_ADMIN only)' })
  @ApiCreatedResponse({ description: 'Tạo product thành công' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'List products (paginated, filterable by category/status, public)' })
  @ApiOkResponse({ description: 'Danh sách product' })
  findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id (public)' })
  @ApiOkResponse({ description: 'Chi tiết 1 product' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a product, regenerating its slug if the name changes (STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiOkResponse({ description: 'Cập nhật product thành công' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a product, cascading to its variants and inventory (STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiNoContentResponse({ description: 'Xoá product thành công' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }

  @Post(':id/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Create a variant under a product, atomically creating its inventory row (STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiCreatedResponse({ description: 'Tạo variant (kèm inventory) thành công' })
  createVariant(@Param('id', ParseUUIDPipe) productId: string, @Body() createVariantDto: CreateVariantDto) {
    return this.productsService.createVariant(productId, createVariantDto);
  }

  @Get(':id/variants')
  @ApiOperation({ summary: 'List variants of a product (paginated, public)' })
  @ApiOkResponse({ description: 'Danh sách variant của 1 product' })
  findAllVariants(@Param('id', ParseUUIDPipe) productId: string, @Query() pagination: PaginationDto) {
    return this.productsService.findAllVariants(productId, pagination);
  }

  @Get(':id/variants/:variantId')
  @ApiOperation({ summary: 'Get a variant by id, scoped to its parent product (public)' })
  @ApiOkResponse({ description: 'Chi tiết 1 variant' })
  findOneVariant(@Param('id', ParseUUIDPipe) productId: string, @Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.productsService.findOneVariant(productId, variantId);
  }

  @Patch(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a variant (STORE_MANAGER/MASTER_ADMIN only)' })
  @ApiOkResponse({ description: 'Cập nhật variant thành công' })
  updateVariant(
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() updateVariantDto: UpdateVariantDto,
  ) {
    return this.productsService.updateVariant(productId, variantId, updateVariantDto);
  }

  @Delete(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a variant, cascading to its inventory (STORE_MANAGER/MASTER_ADMIN only)' })
  @ApiNoContentResponse({ description: 'Xoá variant thành công' })
  removeVariant(@Param('id', ParseUUIDPipe) productId: string, @Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.productsService.removeVariant(productId, variantId);
  }
}
