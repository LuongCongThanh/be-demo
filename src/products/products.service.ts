import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Product, ProductImage } from '#src/generated/prisma/client.js';
import { PrismaService } from '#src/prisma/prisma.service.js';
import { ListProductsQueryDto } from '#src/products/dto/list-products-query.dto.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { paginate, Paginated } from '#src/products/paginate.js';
import { toVariantResponse, VARIANT_INCLUDE } from '#src/products/variant-response.mapper.js';
import { VariantResponseDto } from '#src/products/dto/variant-response.dto.js';

const VISIBLE_PRODUCT = { status: 'ACTIVE' } as const satisfies Prisma.ProductWhereInput;
const VISIBLE_VARIANT = { status: 'ACTIVE' } as const satisfies Prisma.ProductVariantWhereInput;

/**
 * Storefront (công khai): chỉ thấy sản phẩm ACTIVE cùng biến thể ACTIVE.
 * DRAFT/ARCHIVED → 404 như không tồn tại. Back-office đọc qua
 * AdminProductsService.
 */
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lọc size/màu: sản phẩm khớp khi có ít nhất MỘT biến thể ACTIVE thoả cả
   * hai điều kiện cùng lúc (không ghép size của biến thể này với màu của biến
   * thể khác).
   */
  async findAll({ page, limit, categoryId, size, color }: ListProductsQueryDto): Promise<Paginated<Product>> {
    const optionFilter: Prisma.ProductVariantWhereInput = {
      ...VISIBLE_VARIANT,
      ...(size?.length && { size: { code: { in: size } } }),
      ...(color?.length && { color: { code: { in: color } } }),
    };
    const where: Prisma.ProductWhereInput = {
      ...VISIBLE_PRODUCT,
      ...(categoryId && { categoryId }),
      ...((size?.length || color?.length) && { variants: { some: optionFilter } }),
    };
    return paginate(
      page,
      limit,
      (args) => this.prisma.product.findMany({ where, ...args }),
      () => this.prisma.product.count({ where }),
    );
  }

  async findOne(id: string): Promise<Product & { variants: VariantResponseDto[]; images: ProductImage[] }> {
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
    return { ...product, variants: product.variants.map(toVariantResponse) };
  }

  async findAllVariants(productId: string, { page, limit }: PaginationDto): Promise<Paginated<VariantResponseDto>> {
    await this.assertVisible(productId);
    const where: Prisma.ProductVariantWhereInput = { productId, ...VISIBLE_VARIANT };
    const result = await paginate(
      page,
      limit,
      (args) => this.prisma.productVariant.findMany({ where, include: VARIANT_INCLUDE, ...args }),
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
