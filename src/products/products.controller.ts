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
import { ProductsService } from '#src/products/products.service.js';
import { CreateProductDto } from '#src/products/dto/create-product.dto.js';
import { UpdateProductDto } from '#src/products/dto/update-product.dto.js';
import { ListProductsQueryDto } from '#src/products/dto/list-products-query.dto.js';
import { CreateVariantDto } from '#src/products/dto/create-variant.dto.js';
import { UpdateVariantDto } from '#src/products/dto/update-variant.dto.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { ProductResponseDto } from '#src/products/dto/product-response.dto.js';
import { PaginatedProductResponseDto } from '#src/products/dto/paginated-product-response.dto.js';
import { VariantResponseDto } from '#src/products/dto/variant-response.dto.js';
import { PaginatedVariantResponseDto } from '#src/products/dto/paginated-variant-response.dto.js';

@ApiTags(API_TAGS.PRODUCTS.name)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product (ADMIN only)' })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Category not found'], [409, 'Product name already exists'])
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'List products (paginated, filterable by category/status, public)' })
  @ApiOkResponse({ type: PaginatedProductResponseDto })
  @ApiErrorResponses(400)
  findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id (public)' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiErrorResponses(400, [404, 'Product not found'])
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a product, regenerating its slug if the name changes (ADMIN only)',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Product or category not found'], [409, 'Product name already exists'])
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a product, cascading to its variants and inventory (ADMIN only)',
  })
  @ApiNoContentResponse({ description: 'Product deleted' })
  @ApiErrorResponses(400, 401, 403, [404, 'Product not found'])
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }

  @Post(':id/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a variant under a product, atomically creating its inventory row (ADMIN only)',
  })
  @ApiCreatedResponse({ type: VariantResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Product not found'], [409, 'SKU already exists'])
  createVariant(@Param('id', ParseUUIDPipe) productId: string, @Body() createVariantDto: CreateVariantDto) {
    return this.productsService.createVariant(productId, createVariantDto);
  }

  @Get(':id/variants')
  @ApiOperation({ summary: 'List variants of a product (paginated, public)' })
  @ApiOkResponse({ type: PaginatedVariantResponseDto })
  @ApiErrorResponses(400, [404, 'Product not found'])
  findAllVariants(@Param('id', ParseUUIDPipe) productId: string, @Query() pagination: PaginationDto) {
    return this.productsService.findAllVariants(productId, pagination);
  }

  @Get(':id/variants/:variantId')
  @ApiOperation({ summary: 'Get a variant by id, scoped to its parent product (public)' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiErrorResponses(400, [404, 'Variant not found on this product'])
  findOneVariant(@Param('id', ParseUUIDPipe) productId: string, @Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.productsService.findOneVariant(productId, variantId);
  }

  @Patch(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a variant (ADMIN only)' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Variant not found on this product'], [409, 'SKU already exists'])
  updateVariant(
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() updateVariantDto: UpdateVariantDto,
  ) {
    return this.productsService.updateVariant(productId, variantId, updateVariantDto);
  }

  @Delete(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a variant, cascading to its inventory (ADMIN only)' })
  @ApiNoContentResponse({ description: 'Variant deleted' })
  @ApiErrorResponses(400, 401, 403, [404, 'Variant not found on this product'])
  removeVariant(@Param('id', ParseUUIDPipe) productId: string, @Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.productsService.removeVariant(productId, variantId);
  }
}
