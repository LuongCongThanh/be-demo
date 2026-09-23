import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import type { Product, ProductVariant } from '../generated/prisma/client.js';
import { VariantStatus } from '../generated/prisma/enums.js';
import { writeUnique } from '../common/prisma-error.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { CreateVariantDto } from './dto/create-variant.dto.js';
import { UpdateVariantEntryDto } from './dto/update-variant-entry.dto.js';
import { ListVariantsQueryDto } from './dto/list-variants-query.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto): Promise<Product & { variants: ProductVariant[] }> {
    const { variants, ...productFields } = createProductDto;

    const category = await this.prisma.category.findUnique({ where: { id: productFields.categoryId } });
    if (!category) {
      throw new NotFoundException(`Category #${productFields.categoryId} not found`);
    }

    const slug = this.toSlug(productFields.name);
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Product name "${productFields.name}" already exists`);
    }

    for (const variant of variants ?? []) {
      const existingVariant = await this.prisma.productVariant.findUnique({ where: { sku: variant.sku } });
      if (existingVariant) {
        throw new ConflictException(`SKU "${variant.sku}" already exists`);
      }
    }

    if (!variants || variants.length === 0) {
      return writeUnique(
        () => this.prisma.product.create({ data: { ...productFields, slug }, include: { variants: true } }),
        'slug',
        `Product name "${productFields.name}" already exists`,
      );
    }

    // Product + variants + inventory (quantity=0) phải cùng thành công hoặc
    // cùng thất bại như 1 đơn vị — không có trạng thái "product đã tạo nhưng
    // thiếu vài variant" (docs/superpowers/specs 2026-09-18-products-and-variants-design.md).
    return writeUnique(
      () =>
        this.prisma.$transaction(async (tx) => {
          const product = await tx.product.create({ data: { ...productFields, slug } });
          for (const variant of variants) {
            const created = await tx.productVariant.create({ data: { ...variant, productId: product.id } });
            await tx.inventory.create({ data: { variantId: created.id, quantity: 0, reservedQuantity: 0 } });
          }
          // Refetch trong cùng transaction để response embed đúng variants
          // vừa tạo — `product` ở trên chỉ có field của chính nó, chưa có
          // quan hệ (variants được tạo sau, không thể `include` ngược lại).
          // Non-null: vừa create() ở trên trong cùng transaction, chắc chắn tồn tại.
          return (await tx.product.findUnique({ where: { id: product.id }, include: { variants: true } }))!;
        }),
      'slug',
      `Product name "${productFields.name}" already exists`,
    );
  }

  async findAll({ page, limit, categoryId, status }: ListProductsQueryDto): Promise<{
    data: Product[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = { ...(categoryId && { categoryId }), ...(status && { status }) };
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { variants: true },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<Product & { variants: ProductVariant[] }> {
    // Luôn embed variants (kể cả DISCONTINUED, không lọc mặc định) — xem
    // docs/superpowers/specs 2026-09-18-products-and-variants-design.md,
    // mục "GET .../variants embedded".
    const product = await this.prisma.product.findUnique({ where: { id }, include: { variants: true } });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const current = await this.findOne(id);

    if (updateProductDto.categoryId && updateProductDto.categoryId !== current.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: updateProductDto.categoryId } });
      if (!category) {
        throw new NotFoundException(`Category #${updateProductDto.categoryId} not found`);
      }
    }

    const { variants, ...productFields } = updateProductDto;
    const data: Omit<UpdateProductDto, 'variants'> & { slug?: string } = { ...productFields };
    if (updateProductDto.name) {
      const slug = this.toSlug(updateProductDto.name);
      const existing = await this.prisma.product.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Product name "${updateProductDto.name}" already exists`);
      }
      data.slug = slug;
    }

    let updatedProduct = current;
    if (Object.keys(data).length > 0) {
      // Nhánh P2002-trên-'slug' trong writeUnique() chỉ có thể trigger khi data.slug
      // được set ở trên, tức updateProductDto.name luôn có giá trị ở đây — message
      // dưới đây không bao giờ in "undefined".
      updatedProduct = await writeUnique(
        () => this.prisma.product.update({ where: { id }, data, include: { variants: true } }),
        'slug',
        `Product name "${updateProductDto.name}" already exists`,
      );
    }

    if (variants) {
      await this.syncVariants(id, variants);
      // Re-fetch để response phản ánh đúng variants sau khi reconcile (update
      // ở trên có thể chưa chạy — data rỗng — hoặc đã chạy nhưng include cũ).
      return this.findOne(id);
    }

    return updatedProduct;
  }

  // `variants` của PATCH /products/:id là full desired state (không phải
  // patch từng phần tử) — xem docs/superpowers/specs
  // 2026-09-18-products-and-variants-design.md, mục "PATCH .../variants".
  // Vắng mặt trong mảng = discontinue (soft-delete), không hard-delete, để
  // không vi phạm FK RESTRICT từ CartItem/OrderItem.
  private async syncVariants(productId: string, entries: UpdateVariantEntryDto[]): Promise<void> {
    const existing = await this.prisma.productVariant.findMany({ where: { productId } });
    const existingIds = new Set(existing.map((v) => v.id));

    for (const entry of entries) {
      if (entry.id && !existingIds.has(entry.id)) {
        throw new BadRequestException(`Variant #${entry.id} not found on product #${productId}`);
      }
    }

    const incomingIds = new Set(entries.filter((e) => e.id).map((e) => e.id));
    const toDiscontinue = existing.filter((v) => !incomingIds.has(v.id));

    await this.prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const { id, ...fields } = entry;
        if (id) {
          await tx.productVariant.update({ where: { id }, data: fields });
        } else {
          const created = await tx.productVariant.create({ data: { ...(fields as CreateVariantDto), productId } });
          await tx.inventory.create({ data: { variantId: created.id, quantity: 0, reservedQuantity: 0 } });
        }
      }
      for (const variant of toDiscontinue) {
        await tx.productVariant.update({ where: { id: variant.id }, data: { status: VariantStatus.DISCONTINUED } });
      }
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }

  async findAllVariants(
    productId: string,
    { page, limit, status }: ListVariantsQueryDto,
  ): Promise<{ data: ProductVariant[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    await this.findOne(productId); // 404 nếu product không tồn tại

    const where = { productId, ...(status && { status }) };
    const [data, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.productVariant.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneVariant(productId: string, variantId: string): Promise<ProductVariant> {
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) {
      throw new NotFoundException(`Variant #${variantId} not found on product #${productId}`);
    }
    return variant;
  }

  private toSlug(name: string): string {
    const slug = slugify(name, { lower: true, locale: 'vi', strict: true });
    // Tên chỉ gồm ký tự đặc biệt/dấu câu (vd. "!!!") vẫn qua được @IsNotEmpty()
    // (đã trim ở DTO) nhưng slugify trả về "" — nếu cho lọt qua, product đầu
    // tiên kiểu này sẽ có slug rỗng và mọi tên "vô nghĩa" sau đó sẽ bị báo
    // trùng tên (409) dù nhìn không giống nhau chút nào.
    if (!slug) {
      throw new BadRequestException(`Product name "${name}" does not produce a valid slug`);
    }
    return slug;
  }
}
