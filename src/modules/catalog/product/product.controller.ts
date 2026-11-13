import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { ProductService } from '#src/modules/catalog/product/product.service.js';
import { ListProductsQueryDto } from '#src/modules/catalog/product/dto/list-products-query.dto.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { ProductDetailResponseDto } from '#src/modules/catalog/product/dto/product-detail-response.dto.js';
import { PaginatedProductResponseDto } from '#src/modules/catalog/product/dto/paginated-product-response.dto.js';
import { VariantResponseDto } from '#src/modules/catalog/product/dto/variant-response.dto.js';
import { PaginatedVariantResponseDto } from '#src/modules/catalog/product/dto/paginated-variant-response.dto.js';

/** Storefront — công khai, chỉ đọc, chỉ thấy sản phẩm/biến thể ACTIVE. */
@ApiTags(API_TAGS.PRODUCTS.name)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'List ACTIVE products (paginated, filterable by category, public)' })
  @ApiOkResponse({ type: PaginatedProductResponseDto })
  @ApiErrorResponses(400)
  findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an ACTIVE product with its ACTIVE variants (public)' })
  @ApiOkResponse({ type: ProductDetailResponseDto })
  @ApiErrorResponses(400, [404, 'Product not found'])
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Get(':id/variants')
  @ApiOperation({ summary: 'List ACTIVE variants of an ACTIVE product (paginated, public)' })
  @ApiOkResponse({ type: PaginatedVariantResponseDto })
  @ApiErrorResponses(400, [404, 'Product not found'])
  findAllVariants(@Param('id', ParseUUIDPipe) productId: string, @Query() pagination: PaginationDto) {
    return this.productsService.findAllVariants(productId, pagination);
  }

  @Get(':id/variants/:variantId')
  @ApiOperation({ summary: 'Get an ACTIVE variant of an ACTIVE product (public)' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiErrorResponses(400, [404, 'Variant not found on this product'])
  findOneVariant(@Param('id', ParseUUIDPipe) productId: string, @Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.productsService.findOneVariant(productId, variantId);
  }
}
