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
import { Permission } from '#src/common/auth/permission.enum.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { AdminProductService } from '#src/modules/catalog/product/admin-product.service.js';
import { AdminProductImageService } from '#src/modules/catalog/product/admin-product-image.service.js';
import { CreateImageDto } from '#src/modules/catalog/product/dto/create-image.dto.js';
import { UpdateImageDto } from '#src/modules/catalog/product/dto/update-image.dto.js';
import { ImageResponseDto } from '#src/modules/catalog/product/dto/image-response.dto.js';
import { PresignImageDto } from '#src/modules/catalog/product/dto/presign-image.dto.js';
import { PresignedImageUploadResponseDto } from '#src/modules/catalog/product/dto/presigned-image-upload-response.dto.js';
import { CreateProductDto } from '#src/modules/catalog/product/dto/create-product.dto.js';
import { UpdateProductDto } from '#src/modules/catalog/product/dto/update-product.dto.js';
import { AdminListProductsQueryDto } from '#src/modules/catalog/product/dto/admin-list-products-query.dto.js';
import { CreateVariantDto } from '#src/modules/catalog/product/dto/create-variant.dto.js';
import { UpdateVariantDto } from '#src/modules/catalog/product/dto/update-variant.dto.js';
import { ProductResponseDto } from '#src/modules/catalog/product/dto/product-response.dto.js';
import { ProductDetailResponseDto } from '#src/modules/catalog/product/dto/product-detail-response.dto.js';
import { PaginatedProductResponseDto } from '#src/modules/catalog/product/dto/paginated-product-response.dto.js';
import { VariantResponseDto } from '#src/modules/catalog/product/dto/variant-response.dto.js';

const PRODUCT_NOT_FOUND: [404, string] = [404, 'Product not found'];
const VARIANT_NOT_FOUND: [404, string] = [404, 'Variant not found on this product'];

/**
 * Back-office catalog: đọc cho STAFF + ADMIN (mặc định của `/admin/*`), ghi chỉ
 * ADMIN (business/02 §3.2). Không có DELETE — dùng archive (BR-CAT-09).
 */
@ApiTags(API_TAGS.PRODUCTS.name)
@Authorize(Permission.CATALOG_PRODUCT_VIEW)
@Controller('admin/products')
export class AdminProductController {
  constructor(
    private readonly service: AdminProductService,
    private readonly images: AdminProductImageService,
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
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @ApiOperation({ summary: 'Create a product; it starts as DRAFT (ADMIN only)' })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Category not found'], [409, 'Product name already exists'])
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
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
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a product instead of deleting it; idempotent (ADMIN only)' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiErrorResponses(400, 401, 403, PRODUCT_NOT_FOUND)
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(id);
  }

  @Post(':id/unarchive')
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bring an archived product back to ACTIVE; idempotent (ADMIN only)' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiErrorResponses([400, 'Product is still DRAFT'], 401, 403, PRODUCT_NOT_FOUND)
  unarchive(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.unarchive(id);
  }

  @Post(':id/variants')
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @ApiOperation({ summary: 'Create a variant, atomically creating its inventory row (ADMIN only)' })
  @ApiCreatedResponse({ type: VariantResponseDto })
  @ApiErrorResponses(400, 401, 403, PRODUCT_NOT_FOUND, [409, 'SKU already exists'])
  createVariant(@Param('id', ParseUUIDPipe) productId: string, @Body() dto: CreateVariantDto) {
    return this.service.createVariant(productId, dto);
  }

  @Patch(':id/variants/:variantId')
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @ApiOperation({ summary: 'Update a variant (ADMIN only)' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiErrorResponses(400, 401, 403, VARIANT_NOT_FOUND, [
    409,
    'Price at or below a current or upcoming sale price (BR-PRC-05)',
  ])
  updateVariant(
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.service.updateVariant(productId, variantId, dto);
  }

  @Post(':id/variants/:variantId/archive')
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a variant (stop selling it); idempotent (ADMIN only)' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiErrorResponses(400, 401, 403, VARIANT_NOT_FOUND)
  archiveVariant(@Param('id', ParseUUIDPipe) productId: string, @Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.service.setVariantStatus(productId, variantId, 'ARCHIVED');
  }

  @Post(':id/variants/:variantId/unarchive')
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
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

  @Post(':id/images/presign')
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @ApiOperation({
    summary: 'Sign a direct upload of one product image to storage',
    description:
      'JPEG, PNG or WebP, at most 5 MB. POST `fields` and the file (`file`) as multipart form to `uploadUrl`, then attach it with POST /admin/products/:id/images and the returned `storageKey`.',
  })
  @ApiCreatedResponse({ type: PresignedImageUploadResponseDto })
  @ApiErrorResponses(400, 401, 403, PRODUCT_NOT_FOUND, [503, 'Image storage is not configured or unavailable'])
  presignImage(@Param('id', ParseUUIDPipe) productId: string, @Body() dto: PresignImageDto) {
    return this.images.presign(productId, dto);
  }

  @Post(':id/images')
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @ApiOperation({
    summary: 'Attach an uploaded image to a product color; isPrimary replaces that color primary',
    description: 'The file under `storageKey` is checked in storage: missing, too large or wrong format → 422.',
  })
  @ApiCreatedResponse({ type: ImageResponseDto })
  @ApiErrorResponses(
    [400, 'Invalid body, unknown color, or storageKey not issued for this product'],
    401,
    403,
    PRODUCT_NOT_FOUND,
    [422, 'Image not uploaded, larger than 5 MB, or not JPEG/PNG/WebP'],
    [503, 'Image storage is not configured or unavailable'],
  )
  createImage(@Param('id', ParseUUIDPipe) productId: string, @Body() dto: CreateImageDto) {
    return this.images.create(productId, dto);
  }

  @Patch(':id/images/:imageId')
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @ApiOperation({ summary: 'Update image metadata or make it the primary image of its color' })
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
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an image from a product and, best effort, from storage' })
  @ApiNoContentResponse({ description: 'Image removed' })
  @ApiErrorResponses(400, 401, 403, [404, 'Image not found on this product'])
  removeImage(@Param('id', ParseUUIDPipe) productId: string, @Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.images.remove(productId, imageId);
  }
}
