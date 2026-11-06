import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import type { Prisma, Product, ProductStatus, ProductVariant, VariantStatus } from '#src/generated/prisma/client.js';
import { writeUnique } from '#src/common/prisma-error.util.js';
import { PrismaService } from '#src/prisma/prisma.service.js';
import { CreateProductDto } from '#src/products/dto/create-product.dto.js';
import { UpdateProductDto } from '#src/products/dto/update-product.dto.js';
import { AdminListProductsQueryDto } from '#src/products/dto/admin-list-products-query.dto.js';
import { CreateVariantDto } from '#src/products/dto/create-variant.dto.js';
import { UpdateVariantDto } from '#src/products/dto/update-variant.dto.js';
import { paginate, Paginated } from '#src/products/paginate.js';

export type ProductWithVariants = Product & { variants: ProductVariant[] };

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
      (args) => this.prisma.product.findMany({ where, ...args }),
      () => this.prisma.product.count({ where }),
    );
  }

  async findOne(id: string): Promise<ProductWithVariants> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
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

  async createVariant(productId: string, dto: CreateVariantDto): Promise<ProductVariant> {
    await this.findProductOrThrow(productId);

    const existing = await this.prisma.productVariant.findUnique({ where: { sku: dto.sku } });
    if (existing) {
      throw new ConflictException(`SKU "${dto.sku}" already exists`);
    }

    // Variant và inventory (quantity=0) phải cùng tồn tại hoặc cùng không.
    return writeUnique(
      () =>
        this.prisma.$transaction(async (tx) => {
          const variant = await tx.productVariant.create({ data: { ...dto, productId } });
          await tx.inventory.create({ data: { variantId: variant.id, quantity: 0, reservedQuantity: 0 } });
          return variant;
        }),
      'sku',
      `SKU "${dto.sku}" already exists`,
    );
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateVariantDto): Promise<ProductVariant> {
    await this.findVariantOrThrow(productId, variantId);

    if (dto.sku) {
      const existing = await this.prisma.productVariant.findUnique({ where: { sku: dto.sku } });
      if (existing && existing.id !== variantId) {
        throw new ConflictException(`SKU "${dto.sku}" already exists`);
      }
    }

    // where chỉ theo variantId: findVariantOrThrow() đã xác nhận đúng cặp
    // (variantId, productId) và không route nào đổi được productId của variant.
    return writeUnique(
      () => this.prisma.productVariant.update({ where: { id: variantId }, data: dto }),
      'sku',
      `SKU "${dto.sku}" already exists`,
    );
  }

  async setVariantStatus(productId: string, variantId: string, status: VariantStatus): Promise<ProductVariant> {
    const variant = await this.findVariantOrThrow(productId, variantId);
    if (variant.status === status) return variant;
    return this.prisma.productVariant.update({ where: { id: variantId }, data: { status } });
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
    const slug = slugify(name, { lower: true, locale: 'vi', strict: true });
    // Tên chỉ gồm ký tự đặc biệt (vd. "!!!") qua được @IsNotEmpty() nhưng sinh
    // slug rỗng — chặn lại thay vì để mọi tên "vô nghĩa" sau đó báo trùng.
    if (!slug) {
      throw new BadRequestException(`Product name "${name}" does not produce a valid slug`);
    }
    const existing = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (existing && existing.id !== selfId) {
      throw new ConflictException(`Product name "${name}" already exists`);
    }
    return slug;
  }
}
