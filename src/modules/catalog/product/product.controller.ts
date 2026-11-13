import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { ProductService } from '#src/modules/catalog/product/product.service.js';
import { ListProductsQueryDto } from '#src/modules/catalog/product/dto/list-products-query.dto.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { StorefrontProductDetailResponseDto } from '#src/modules/catalog/product/dto/storefront-product-detail-response.dto.js';
import { PaginatedProductListResponseDto } from '#src/modules/catalog/product/dto/paginated-product-list-response.dto.js';
import { VariantResponseDto } from '#src/modules/catalog/product/dto/variant-response.dto.js';
import { PaginatedVariantResponseDto } from '#src/modules/catalog/product/dto/paginated-variant-response.dto.js';

/** Storefront — công khai, chỉ đọc, chỉ thấy sản phẩm/biến thể ACTIVE. */
@ApiTags(API_TAGS.PRODUCTS.name)
@Controller('products')
export class ProductController {
  constructor(private readonly productsService: ProductService) {}

  @Get()
  @ApiOperation({
    summary: 'List ACTIVE products with a price range (paginated, public)',
    description:
      'Search by name; filter by category (with descendants), gender, size, color, price and onSale; sort by newest, Effective price or discount.',
  })
  @ApiOkResponse({ type: PaginatedProductListResponseDto })
  @ApiErrorResponses(400)
  findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get an ACTIVE product by slug with its ACTIVE variants (public)' })
  @ApiOkResponse({ type: StorefrontProductDetailResponseDto })
  @ApiErrorResponses([404, 'Product not found'])
  findOneBySlug(@Param('slug') slug: string) {
    return this.productsService.findOneBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an ACTIVE product with its ACTIVE variants (public)' })
  @ApiOkResponse({ type: StorefrontProductDetailResponseDto })
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
