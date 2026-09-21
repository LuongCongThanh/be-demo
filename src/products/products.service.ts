import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { Prisma } from '../generated/prisma/client.js';
import type { Product, ProductVariant } from '../generated/prisma/client.js';
import { getUniqueConstraintTarget } from '../common/prisma-error.util.js';
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

    try {
      return await this.prisma.product.create({ data: { ...createProductDto, slug } });
    } catch (err) {
      // Pre-check ở trên chỉ chặn được phần lớn trường hợp trùng tên; 2
      // request đồng thời cùng tên đều có thể pass check đó (race window),
      // nên unique constraint trên `slug` mới là chốt chặn thật sự. Chuyển
      // race đó thành cùng lỗi 409 thân thiện như pre-check, thay vì để rơi
      // xuống message thô của Prisma qua AllExceptionsFilter.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        getUniqueConstraintTarget(err)?.includes('slug')
      ) {
        throw new ConflictException(`Product name "${createProductDto.name}" already exists`);
      }
      throw err;
    }
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

    try {
      return await this.prisma.product.update({ where: { id }, data });
    } catch (err) {
      // Cùng race window như create() — 2 request đổi tên sang cùng 1 slug
      // gần như đồng thời đều có thể pass pre-check ở trên.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        getUniqueConstraintTarget(err)?.includes('slug')
      ) {
        throw new ConflictException(`Product name "${updateProductDto.name}" already exists`);
      }
      throw err;
    }
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
    try {
      return await this.prisma.$transaction(async (tx) => {
        const variant = await tx.productVariant.create({ data: { ...createVariantDto, productId } });
        await tx.inventory.create({ data: { variantId: variant.id, quantity: 0, reservedQuantity: 0 } });
        return variant;
      });
    } catch (err) {
      // Cùng race window như create() ở Product — 2 request tạo variant
      // cùng sku gần như đồng thời đều có thể pass pre-check ở trên.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        getUniqueConstraintTarget(err)?.includes('sku')
      ) {
        throw new ConflictException(`SKU "${createVariantDto.sku}" already exists`);
      }
      throw err;
    }
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

    if (updateVariantDto.sku) {
      const existing = await this.prisma.productVariant.findUnique({ where: { sku: updateVariantDto.sku } });
      if (existing && existing.id !== variantId) {
        throw new ConflictException(`SKU "${updateVariantDto.sku}" already exists`);
      }
    }

    try {
      return await this.prisma.productVariant.update({ where: { id: variantId }, data: updateVariantDto });
    } catch (err) {
      // Cùng race window như update() ở Product — 2 request đổi sang cùng
      // 1 sku gần như đồng thời đều có thể pass pre-check ở trên.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        getUniqueConstraintTarget(err)?.includes('sku')
      ) {
        throw new ConflictException(`SKU "${updateVariantDto.sku}" already exists`);
      }
      throw err;
    }
  }

  async removeVariant(productId: string, variantId: string): Promise<void> {
    await this.findOneVariant(productId, variantId);
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
