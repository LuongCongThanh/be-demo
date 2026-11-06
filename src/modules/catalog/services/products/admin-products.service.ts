import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '#src/generated/prisma/client.js';
import type {
  Product,
  ProductImage,
  ProductStatus,
  ProductVariant,
  VariantStatus,
} from '#src/generated/prisma/client.js';
import { getUniqueConstraintTarget, writeUnique } from '#src/common/utils/prisma-error.util.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CreateProductDto } from '#src/modules/catalog/dto/products/create-product.dto.js';
import { UpdateProductDto } from '#src/modules/catalog/dto/products/update-product.dto.js';
import { AdminListProductsQueryDto } from '#src/modules/catalog/dto/products/admin-list-products-query.dto.js';
import { CreateVariantDto } from '#src/modules/catalog/dto/products/create-variant.dto.js';
import { UpdateVariantDto } from '#src/modules/catalog/dto/products/update-variant.dto.js';
import { NEWEST_FIRST, paginate, Paginated } from '#src/common/pagination/paginate.js';
import { toSlugOrThrow } from '#src/common/utils/slug.util.js';
import { VariantResponseDto } from '#src/modules/catalog/dto/products/variant-response.dto.js';
import { VARIANT_INCLUDE } from '#src/modules/catalog/constants/variant-include.constant.js';
import { toVariantResponse } from '#src/modules/catalog/mappers/variant-response.mapper.js';

export type ProductDetail = Product & { variants: VariantResponseDto[]; images: ProductImage[] };

/**
 * Back-office catalog (STAFF đọc, ADMIN ghi). Không có xoá cứng: "xoá" là
 * archive (BR-CAT-09) — dữ liệu đơn hàng sau này luôn tham chiếu được.
 *
 * Chuyển trạng thái sản phẩm: DRAFT → ACTIVE, ACTIVE ↔ ARCHIVED,
 * DRAFT → ARCHIVED. Không quay về DRAFT. `publishedAt` set ở lần đầu ACTIVE.
 */
@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto): Promise<Product> {
    await this.assertCategoryExists(dto.categoryId);
    const slug = await this.uniqueSlug(dto.name);

    return writeUnique(
      () => this.prisma.product.create({ data: { ...dto, slug } }),
      'slug',
      `Product name "${dto.name}" already exists`,
    );
  }

  async findAll({ page, limit, categoryId, status }: AdminListProductsQueryDto): Promise<Paginated<Product>> {
    const where: Prisma.ProductWhereInput = { ...(categoryId && { categoryId }), ...(status && { status }) };
    return paginate(
      page,
      limit,
      (args) => this.prisma.product.findMany({ where, orderBy: [...NEWEST_FIRST], ...args }),
      () => this.prisma.product.count({ where }),
    );
  }

  async findOne(id: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: { include: VARIANT_INCLUDE, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        images: { orderBy: [{ colorId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return { ...product, variants: product.variants.map(toVariantResponse) };
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const current = await this.findProductOrThrow(id);

    if (dto.categoryId && dto.categoryId !== current.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const { status, ...fields } = dto;
    const data: Prisma.ProductUncheckedUpdateInput = { ...fields, ...this.statusChange(current, status) };
    if (dto.name) {
      data.slug = await this.uniqueSlug(dto.name, id);
    }

    return writeUnique(
      () => this.prisma.product.update({ where: { id }, data }),
      'slug',
      `Product name "${dto.name}" already exists`,
    );
  }

  /** Idempotent: đã ARCHIVED thì trả nguyên trạng. */
  async archive(id: string): Promise<Product> {
    return this.transition(id, 'ARCHIVED');
  }

  /** ARCHIVED → ACTIVE; đã ACTIVE thì trả nguyên trạng. DRAFT → 400 (phải publish). */
  async unarchive(id: string): Promise<Product> {
    const current = await this.findProductOrThrow(id);
    if (current.status === 'DRAFT') {
      throw new BadRequestException('A DRAFT product is not archived — publish it by setting status ACTIVE');
    }
    return this.transition(id, 'ACTIVE');
  }

  async createVariant(productId: string, dto: CreateVariantDto): Promise<VariantResponseDto> {
    await this.findProductOrThrow(productId);
    await this.assertSelectable(dto.sizeId, dto.colorId);

    // Pre-check cho message rõ ràng; UK sku và UK (product, size, color) ở DB
    // vẫn là chốt chặn thật khi 2 request chạy đồng thời.
    const [skuTaken, comboTaken] = await Promise.all([
      this.prisma.productVariant.findUnique({ where: { sku: dto.sku }, select: { id: true } }),
      this.prisma.productVariant.findUnique({
        where: { productId_sizeId_colorId: { productId, sizeId: dto.sizeId, colorId: dto.colorId } },
        select: { id: true },
      }),
    ]);
    if (skuTaken) throw new ConflictException(`SKU "${dto.sku}" already exists`);
    if (comboTaken) throw new ConflictException('This product already has a variant with this size and color');

    try {
      // Variant và inventory (quantity=0) phải cùng tồn tại hoặc cùng không.
      const variant = await this.prisma.$transaction(async (tx) => {
        const created = await tx.productVariant.create({ data: { ...dto, productId }, include: VARIANT_INCLUDE });
        await tx.inventory.create({ data: { variantId: created.id, quantity: 0, reservedQuantity: 0 } });
        return created;
      });
      return toVariantResponse(variant);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = getUniqueConstraintTarget(err) ?? [];
        throw new ConflictException(
          target.includes('sku')
            ? `SKU "${dto.sku}" already exists`
            : 'This product already has a variant with this size and color',
        );
      }
      throw err;
    }
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateVariantDto): Promise<VariantResponseDto> {
    await this.findVariantOrThrow(productId, variantId);
    // where chỉ theo variantId: findVariantOrThrow() đã xác nhận đúng cặp
    // (variantId, productId) và không route nào đổi được productId của variant.
    const variant = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: dto,
      include: VARIANT_INCLUDE,
    });
    return toVariantResponse(variant);
  }

  async setVariantStatus(productId: string, variantId: string, status: VariantStatus): Promise<VariantResponseDto> {
    const variant = await this.findVariantOrThrow(productId, variantId);
    const updated =
      variant.status === status
        ? await this.prisma.productVariant.findUniqueOrThrow({ where: { id: variantId }, include: VARIANT_INCLUDE })
        : await this.prisma.productVariant.update({
            where: { id: variantId },
            data: { status },
            include: VARIANT_INCLUDE,
          });
    return toVariantResponse(updated);
  }

  /** Biến thể mới chỉ được chọn size/màu đang hiển thị; biến thể cũ dùng mục đã ẩn vẫn chạy bình thường. */
  private async assertSelectable(sizeId: string, colorId: string): Promise<void> {
    const [size, color] = await Promise.all([
      this.prisma.size.findUnique({ where: { id: sizeId }, select: { isHidden: true } }),
      this.prisma.color.findUnique({ where: { id: colorId }, select: { isHidden: true } }),
    ]);
    if (!size || size.isHidden) throw new BadRequestException(`Size #${sizeId} does not exist or is hidden`);
    if (!color || color.isHidden) throw new BadRequestException(`Color #${colorId} does not exist or is hidden`);
  }

  private async transition(id: string, status: ProductStatus): Promise<Product> {
    const current = await this.findProductOrThrow(id);
    if (current.status === status) return current;
    return this.prisma.product.update({ where: { id }, data: this.statusChange(current, status) });
  }

  private statusChange(current: Product, next: ProductStatus | undefined): Prisma.ProductUncheckedUpdateInput {
    if (!next || next === current.status) return {};
    if (next === 'DRAFT') {
      throw new BadRequestException(`Cannot move a ${current.status} product back to DRAFT`);
    }
    return {
      status: next,
      ...(next === 'ACTIVE' && !current.publishedAt && { publishedAt: new Date() }),
    };
  }

  private async findProductOrThrow(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  private async findVariantOrThrow(productId: string, variantId: string): Promise<ProductVariant> {
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) {
      throw new NotFoundException(`Variant #${variantId} not found on product #${productId}`);
    }
    return variant;
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) {
      throw new NotFoundException(`Category #${categoryId} not found`);
    }
  }

  /** Pre-check trùng tên cho message rõ ràng; unique constraint vẫn là chốt chặn thật. */
  private async uniqueSlug(name: string, selfId?: string): Promise<string> {
    const slug = toSlugOrThrow(name, 'Product');
    const existing = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (existing && existing.id !== selfId) {
      throw new ConflictException(`Product name "${name}" already exists`);
    }
    return slug;
  }
}
