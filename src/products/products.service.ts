import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import type { Product, ProductVariant } from '../generated/prisma/client.js';
import { writeUnique } from '../common/prisma-error.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { CreateVariantDto } from './dto/create-variant.dto.js';
import { UpdateVariantDto } from './dto/update-variant.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const category = await this.prisma.category.findUnique({ where: { id: createProductDto.categoryId } });
    if (!category) {
      throw new NotFoundException(`Category #${createProductDto.categoryId} not found`);
    }

    const slug = this.toSlug(createProductDto.name);
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Product name "${createProductDto.name}" already exists`);
    }

    return writeUnique(
      () => this.prisma.product.create({ data: { ...createProductDto, slug } }),
      'slug',
      `Product name "${createProductDto.name}" already exists`,
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
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
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

    const data: UpdateProductDto & { slug?: string } = { ...updateProductDto };
    if (updateProductDto.name) {
      const slug = this.toSlug(updateProductDto.name);
      const existing = await this.prisma.product.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Product name "${updateProductDto.name}" already exists`);
      }
      data.slug = slug;
    }

    // Nhánh P2002-trên-'slug' trong writeUnique() chỉ có thể trigger khi data.slug
    // được set ở trên, tức updateProductDto.name luôn có giá trị ở đây — message
    // dưới đây không bao giờ in "undefined".
    return writeUnique(
      () => this.prisma.product.update({ where: { id }, data }),
      'slug',
      `Product name "${updateProductDto.name}" already exists`,
    );
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }

  async createVariant(productId: string, createVariantDto: CreateVariantDto): Promise<ProductVariant> {
    await this.findOne(productId); // 404 nếu product không tồn tại

    const existing = await this.prisma.productVariant.findUnique({ where: { sku: createVariantDto.sku } });
    if (existing) {
      throw new ConflictException(`SKU "${createVariantDto.sku}" already exists`);
    }

    // Transaction: variant và inventory (quantity=0) phải cùng tồn tại hoặc
    // cùng không tồn tại — không có trạng thái "có variant nhưng thiếu
    // inventory" (Mục 3 tài liệu kiến trúc). Inventory module (Phase 4) chỉ
    // đọc/điều chỉnh dòng này, không phải nơi tạo dòng đầu tiên.
    return writeUnique(
      () =>
        this.prisma.$transaction(async (tx) => {
          const variant = await tx.productVariant.create({ data: { ...createVariantDto, productId } });
          await tx.inventory.create({ data: { variantId: variant.id, quantity: 0, reservedQuantity: 0 } });
          return variant;
        }),
      'sku',
      `SKU "${createVariantDto.sku}" already exists`,
    );
  }

  async findAllVariants(
    productId: string,
    { page, limit }: PaginationDto,
  ): Promise<{ data: ProductVariant[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    await this.findOne(productId); // 404 nếu product không tồn tại

    const where = { productId };
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

  async updateVariant(
    productId: string,
    variantId: string,
    updateVariantDto: UpdateVariantDto,
  ): Promise<ProductVariant> {
    await this.findOneVariant(productId, variantId); // 404 nếu không thuộc đúng product

    // Write bên dưới chỉ where theo variantId (không kèm productId) vì
    // findOneVariant() ở trên đã xác nhận đúng cặp (variantId, productId), và
    // không có route nào cho phép đổi productId của 1 variant đã tạo. Nếu sau
    // này productId trở thành field có thể sửa, phải where theo cả 2.
    if (updateVariantDto.sku) {
      const existing = await this.prisma.productVariant.findUnique({ where: { sku: updateVariantDto.sku } });
      if (existing && existing.id !== variantId) {
        throw new ConflictException(`SKU "${updateVariantDto.sku}" already exists`);
      }
    }

    // Nhánh P2002-trên-'sku' trong writeUnique() chỉ có thể trigger khi
    // updateVariantDto.sku có giá trị (data không chứa sku thì không thể vi
    // phạm unique constraint của sku) — message dưới đây không bao giờ in
    // "undefined". Cùng lý do đã áp dụng cho update() ở trên với 'slug'.
    return writeUnique(
      () => this.prisma.productVariant.update({ where: { id: variantId }, data: updateVariantDto }),
      'sku',
      `SKU "${updateVariantDto.sku}" already exists`,
    );
  }

  async removeVariant(productId: string, variantId: string): Promise<void> {
    await this.findOneVariant(productId, variantId); // xác nhận đúng cặp (variantId, productId)
    // Where theo variantId là đủ — xem comment ở updateVariant() cho lý do.
    await this.prisma.productVariant.delete({ where: { id: variantId } });
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
