import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Product } from '#src/generated/prisma/client.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';
import { toImageResponse } from '#src/modules/catalog/product/product-image.mapper.js';
import { ImageResponseDto } from '#src/modules/catalog/product/dto/image-response.dto.js';
import { ListProductsQueryDto } from '#src/modules/catalog/product/dto/list-products-query.dto.js';
import { ProductListItemResponseDto } from '#src/modules/catalog/product/dto/product-list-item-response.dto.js';
import { productSearchSql } from '#src/modules/catalog/product/product-search.query.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { NEWEST_FIRST, paginate, Paginated } from '#src/common/pagination/paginate.js';
import { VARIANT_INCLUDE } from '#src/modules/catalog/product/product.constants.js';
import { toVariantResponse } from '#src/modules/catalog/product/variant-response.mapper.js';
import { VariantResponseDto } from '#src/modules/catalog/product/dto/variant-response.dto.js';

const VISIBLE_PRODUCT = { status: 'ACTIVE' } as const satisfies Prisma.ProductWhereInput;
const VISIBLE_VARIANT = { status: 'ACTIVE' } as const satisfies Prisma.ProductVariantWhereInput;

/** Ảnh thẻ sản phẩm: ảnh primary trước, rồi theo thứ tự hiển thị. */
const CARD_IMAGE_FIRST = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
] as const satisfies Prisma.ProductImageOrderByWithRelationInput[];

interface PricedRow {
  id: string;
  minPrice: bigint;
  maxPrice: bigint;
}

/**
 * Storefront (công khai): chỉ thấy sản phẩm ACTIVE cùng biến thể ACTIVE.
 * DRAFT/ARCHIVED → 404 như không tồn tại. Back-office đọc qua
 * AdminProductService.
 */
@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CloudinaryClient,
  ) {}

  /** Lọc, tìm kiếm, sắp xếp: xem `productSearchSql`. */
  async findAll(query: ListProductsQueryDto): Promise<Paginated<ProductListItemResponseDto>> {
    const sql = productSearchSql(query);
    return paginate(
      query.page,
      query.limit,
      async ({ skip, take }) => {
        const rows = await this.prisma.$queryRaw<PricedRow[]>(sql.page(skip, take));
        const products = await this.prisma.product.findMany({
          where: { id: { in: rows.map((r) => r.id) } },
          include: { images: { orderBy: CARD_IMAGE_FIRST, take: 1 } },
        });
        const byId = new Map(products.map((product) => [product.id, product]));
        return rows.flatMap(({ id, minPrice, maxPrice }) => {
          const found = byId.get(id);
          if (!found) return [];
          const { images, ...product } = found;
          const imageUrl = images[0] ? this.storage.publicUrl(images[0].storageKey) : null;
          return [{ ...product, minPrice: Number(minPrice), maxPrice: Number(maxPrice), imageUrl }];
        });
      },
      async () => (await this.prisma.$queryRaw<{ total: number }[]>(sql.count))[0].total,
    );
  }

  async findOne(id: string): Promise<Product & { variants: VariantResponseDto[]; images: ImageResponseDto[] }> {
    const product = await this.prisma.product.findFirst({
      where: { id, ...VISIBLE_PRODUCT },
      include: {
        variants: { where: VISIBLE_VARIANT, include: VARIANT_INCLUDE, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        images: { orderBy: [{ colorId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return {
      ...product,
      variants: product.variants.map(toVariantResponse),
      images: product.images.map((image) => toImageResponse(image, this.storage)),
    };
  }

  async findAllVariants(productId: string, { page, limit }: PaginationDto): Promise<Paginated<VariantResponseDto>> {
    await this.assertVisible(productId);
    const where: Prisma.ProductVariantWhereInput = { productId, ...VISIBLE_VARIANT };
    const result = await paginate(
      page,
      limit,
      (args) =>
        this.prisma.productVariant.findMany({ where, include: VARIANT_INCLUDE, orderBy: [...NEWEST_FIRST], ...args }),
      () => this.prisma.productVariant.count({ where }),
    );
    return { ...result, data: result.data.map(toVariantResponse) };
  }

  async findOneVariant(productId: string, variantId: string): Promise<VariantResponseDto> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, ...VISIBLE_VARIANT, product: VISIBLE_PRODUCT },
      include: VARIANT_INCLUDE,
    });
    if (!variant) {
      throw new NotFoundException(`Variant #${variantId} not found on product #${productId}`);
    }
    return toVariantResponse(variant);
  }

  private async assertVisible(productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, ...VISIBLE_PRODUCT },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(`Product #${productId} not found`);
    }
  }
}
