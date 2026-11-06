import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Product, ProductVariant } from '#src/generated/prisma/client.js';
import { PrismaService } from '#src/prisma/prisma.service.js';
import { ListProductsQueryDto } from '#src/products/dto/list-products-query.dto.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { paginate, Paginated } from '#src/products/paginate.js';

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

  async findAll({ page, limit, categoryId }: ListProductsQueryDto): Promise<Paginated<Product>> {
    const where: Prisma.ProductWhereInput = { ...VISIBLE_PRODUCT, ...(categoryId && { categoryId }) };
    return paginate(
      page,
      limit,
      (args) => this.prisma.product.findMany({ where, ...args }),
      () => this.prisma.product.count({ where }),
    );
  }

  async findOne(id: string): Promise<Product & { variants: ProductVariant[] }> {
    const product = await this.prisma.product.findFirst({
      where: { id, ...VISIBLE_PRODUCT },
      include: { variants: { where: VISIBLE_VARIANT, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  async findAllVariants(productId: string, { page, limit }: PaginationDto): Promise<Paginated<ProductVariant>> {
    await this.assertVisible(productId);
    const where: Prisma.ProductVariantWhereInput = { productId, ...VISIBLE_VARIANT };
    return paginate(
      page,
      limit,
      (args) => this.prisma.productVariant.findMany({ where, ...args }),
      () => this.prisma.productVariant.count({ where }),
    );
  }

  async findOneVariant(productId: string, variantId: string): Promise<ProductVariant> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, ...VISIBLE_VARIANT, product: VISIBLE_PRODUCT },
    });
    if (!variant) {
      throw new NotFoundException(`Variant #${variantId} not found on product #${productId}`);
    }
    return variant;
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
