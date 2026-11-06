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
import { AdminProductsService } from '#src/modules/catalog/services/products/admin-products.service.js';
import { AdminProductImagesService } from '#src/modules/catalog/services/products/admin-product-images.service.js';
import { CreateImageDto } from '#src/modules/catalog/dto/products/create-image.dto.js';
import { UpdateImageDto } from '#src/modules/catalog/dto/products/update-image.dto.js';
import { ImageResponseDto } from '#src/modules/catalog/dto/products/image-response.dto.js';
import { CreateProductDto } from '#src/modules/catalog/dto/products/create-product.dto.js';
import { UpdateProductDto } from '#src/modules/catalog/dto/products/update-product.dto.js';
import { AdminListProductsQueryDto } from '#src/modules/catalog/dto/products/admin-list-products-query.dto.js';
import { CreateVariantDto } from '#src/modules/catalog/dto/products/create-variant.dto.js';
import { UpdateVariantDto } from '#src/modules/catalog/dto/products/update-variant.dto.js';
import { ProductResponseDto } from '#src/modules/catalog/dto/products/product-response.dto.js';
import { ProductDetailResponseDto } from '#src/modules/catalog/dto/products/product-detail-response.dto.js';
import { PaginatedProductResponseDto } from '#src/modules/catalog/dto/products/paginated-product-response.dto.js';
import { VariantResponseDto } from '#src/modules/catalog/dto/products/variant-response.dto.js';

const PRODUCT_NOT_FOUND: [404, string] = [404, 'Product not found'];
const VARIANT_NOT_FOUND: [404, string] = [404, 'Variant not found on this product'];

/**
 * Back-office catalog: đọc cho STAFF + ADMIN (mặc định của `/admin/*`), ghi chỉ
 * ADMIN (business/02 §3.2). Không có DELETE — dùng archive (BR-CAT-09).
 */
@ApiTags(API_TAGS.PRODUCTS.name)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STAFF', 'ADMIN')
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly service: AdminProductsService,
    private readonly images: AdminProductImagesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List products of any status (paginated, filterable by category/status, STAFF/ADMIN)' })
  @ApiOkResponse({ type: PaginatedProductResponseDto })
  @ApiErrorResponses(400, 401, 403)
  findAll(@Query() query: AdminListProductsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product of any status with all its variants (STAFF/ADMIN)' })
  @ApiOkResponse({ type: ProductDetailResponseDto })
  @ApiErrorResponses(400, 401, 403, PRODUCT_NOT_FOUND)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a product; it starts as DRAFT (ADMIN only)' })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Category not found'], [409, 'Product name already exists'])
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Update a product; changing status follows DRAFT → ACTIVE ↔ ARCHIVED (ADMIN only)',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiErrorResponses(
    [400, 'Invalid body or status transition'],
    401,
    403,
    [404, 'Product or category not found'],
    [409, 'Product name already exists'],
  )
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/archive')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a product instead of deleting it; idempotent (ADMIN only)' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiErrorResponses(400, 401, 403, PRODUCT_NOT_FOUND)
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(id);
  }

  @Post(':id/unarchive')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bring an archived product back to ACTIVE; idempotent (ADMIN only)' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiErrorResponses([400, 'Product is still DRAFT'], 401, 403, PRODUCT_NOT_FOUND)
  unarchive(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.unarchive(id);
  }

  @Post(':id/variants')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a variant, atomically creating its inventory row (ADMIN only)' })
  @ApiCreatedResponse({ type: VariantResponseDto })
  @ApiErrorResponses(400, 401, 403, PRODUCT_NOT_FOUND, [409, 'SKU already exists'])
  createVariant(@Param('id', ParseUUIDPipe) productId: string, @Body() dto: CreateVariantDto) {
    return this.service.createVariant(productId, dto);
  }

  @Patch(':id/variants/:variantId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a variant (ADMIN only)' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiErrorResponses(400, 401, 403, VARIANT_NOT_FOUND, [409, 'SKU already exists'])
  updateVariant(
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.service.updateVariant(productId, variantId, dto);
  }

  @Post(':id/variants/:variantId/archive')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a variant (stop selling it); idempotent (ADMIN only)' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiErrorResponses(400, 401, 403, VARIANT_NOT_FOUND)
  archiveVariant(@Param('id', ParseUUIDPipe) productId: string, @Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.service.setVariantStatus(productId, variantId, 'ARCHIVED');
  }

  @Post(':id/variants/:variantId/unarchive')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bring an archived variant back to ACTIVE; idempotent (ADMIN only)' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiErrorResponses(400, 401, 403, VARIANT_NOT_FOUND)
  unarchiveVariant(
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.service.setVariantStatus(productId, variantId, 'ACTIVE');
  }

  @Post(':id/images')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Attach image metadata to a product color; isPrimary replaces that color primary (ADMIN only)',
  })
  @ApiCreatedResponse({ type: ImageResponseDto })
  @ApiErrorResponses([400, 'Invalid body or unknown color'], 401, 403, PRODUCT_NOT_FOUND)
  createImage(@Param('id', ParseUUIDPipe) productId: string, @Body() dto: CreateImageDto) {
    return this.images.create(productId, dto);
  }

  @Patch(':id/images/:imageId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update image metadata or make it the primary image of its color (ADMIN only)' })
  @ApiOkResponse({ type: ImageResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Image not found on this product'])
  updateImage(
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateImageDto,
  ) {
    return this.images.update(productId, imageId, dto);
  }

  @Delete(':id/images/:imageId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove image metadata from a product (ADMIN only)' })
  @ApiNoContentResponse({ description: 'Image removed' })
  @ApiErrorResponses(400, 401, 403, [404, 'Image not found on this product'])
  removeImage(@Param('id', ParseUUIDPipe) productId: string, @Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.images.remove(productId, imageId);
  }
}
