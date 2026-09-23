import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import type { Prisma, Product, ProductImage, ProductVariant } from '../generated/prisma/client.js';
import { VariantStatus } from '../generated/prisma/enums.js';
import { writeUnique } from '../common/prisma-error.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { CreateVariantDto } from './dto/create-variant.dto.js';
import { UpdateVariantEntryDto } from './dto/update-variant-entry.dto.js';
import { ProductImagesService } from './product-images.service.js';

// `images` luôn sắp theo sort_order (images[0] là Cover Image) và giấu
// sort_order khỏi response — thứ tự mảng đã là thông tin duy nhất client cần.
const PRODUCT_INCLUDE = {
  variants: true,
  images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], omit: { sortOrder: true } },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Product & {
  variants: ProductVariant[];
  images: Omit<ProductImage, 'sortOrder'>[];
};

interface VariantSyncPlan {
  entries: UpdateVariantEntryDto[];
  toDiscontinue: ProductVariant[];
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productImagesService: ProductImagesService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<ProductWithRelations> {
    const { variants, images, ...productFields } = createProductDto;

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

    if ((!variants || variants.length === 0) && (!images || images.length === 0)) {
      return writeUnique(
        () => this.prisma.product.create({ data: { ...productFields, slug }, include: PRODUCT_INCLUDE }),
        'slug',
        `Product name "${productFields.name}" already exists`,
      );
    }

    // Sinh id trước transaction — ảnh được copy sang `products/<productId>/`
    // trong plan() (gọi mạng, phải chạy ngoài transaction), lúc đó product
    // chưa tồn tại. Chạy sau các pre-check rẻ ở trên để 404/409 không tốn copy.
    const productId = randomUUID();
    const imagePlan = images?.length ? await this.productImagesService.plan(productId, [], images) : undefined;

    // Product + variants + inventory (quantity=0) + images phải cùng thành
    // công hoặc cùng thất bại như 1 đơn vị — không có trạng thái "product đã
    // tạo nhưng thiếu vài variant/ảnh".
    return this.productImagesService.commit(imagePlan, () =>
      writeUnique(
        () =>
          this.prisma.$transaction(async (tx) => {
            await tx.product.create({ data: { ...productFields, id: productId, slug } });
            for (const variant of variants ?? []) {
              const created = await tx.productVariant.create({ data: { ...variant, productId } });
              await tx.inventory.create({ data: { variantId: created.id, quantity: 0, reservedQuantity: 0 } });
            }
            if (imagePlan) {
              await this.productImagesService.apply(tx, productId, imagePlan);
            }
            // Refetch trong cùng transaction để response embed đúng
            // variants/images vừa tạo. Non-null: vừa create() ở trên trong
            // cùng transaction, chắc chắn tồn tại.
            return (await tx.product.findUnique({ where: { id: productId }, include: PRODUCT_INCLUDE }))!;
          }),
        'slug',
        `Product name "${productFields.name}" already exists`,
      ),
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
        include: PRODUCT_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<ProductWithRelations> {
    // Luôn embed variants (kể cả DISCONTINUED, không lọc mặc định) — xem
    // docs/specs/03-products.md — không có endpoint con cho variants/images.
    const product = await this.prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<ProductWithRelations> {
    const current = await this.findOne(id);

    if (updateProductDto.categoryId && updateProductDto.categoryId !== current.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: updateProductDto.categoryId } });
      if (!category) {
        throw new NotFoundException(`Category #${updateProductDto.categoryId} not found`);
      }
    }

    const { variants, images, ...productFields } = updateProductDto;
    const data: Omit<UpdateProductDto, 'variants' | 'images'> & { slug?: string } = { ...productFields };
    if (updateProductDto.name) {
      const slug = this.toSlug(updateProductDto.name);
      const existing = await this.prisma.product.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Product name "${updateProductDto.name}" already exists`);
      }
      data.slug = slug;
    }

    const hasFieldChanges = Object.keys(data).length > 0;
    if (!hasFieldChanges && !variants && !images) {
      return current;
    }

    const variantPlan = variants ? this.planVariantSync(id, current.variants, variants) : undefined;
    // Gọi mạng (HEAD + copy) nên chạy cuối cùng trong phần pre-check, và
    // trước transaction — không giữ transaction trong lúc chờ storage.
    const imagePlan = images ? await this.productImagesService.plan(id, current.images, images) : undefined;

    // Product fields + variants + images trong 1 transaction duy nhất — lỗi ở
    // bất kỳ bước nào rollback toàn bộ aggregate (docs/specs/03-products.md).
    // 2 lớp writeUnique: race trên slug (đổi tên) và trên sku (variant mới)
    // đều phải thành 409 thân thiện thay vì message thô của Prisma.
    await this.productImagesService.commit(imagePlan, () =>
      writeUnique(
        () =>
          writeUnique(
            () =>
              this.prisma.$transaction(async (tx) => {
                if (hasFieldChanges) {
                  await tx.product.update({ where: { id }, data });
                }
                if (variantPlan) {
                  await this.applyVariantSync(tx, id, variantPlan);
                }
                if (imagePlan) {
                  await this.productImagesService.apply(tx, id, imagePlan);
                }
              }),
            'sku',
            'SKU already exists',
          ),
        'slug',
        `Product name "${updateProductDto.name}" already exists`,
      ),
    );

    return this.findOne(id);
  }

  // `variants` của PATCH /products/:id là full desired state (không phải
  // patch từng phần tử). Vắng mặt trong mảng = discontinue (soft-delete),
  // không hard-delete, để không vi phạm FK RESTRICT từ CartItem/OrderItem.
  private planVariantSync(
    productId: string,
    existing: ProductVariant[],
    entries: UpdateVariantEntryDto[],
  ): VariantSyncPlan {
    const existingIds = new Set(existing.map((v) => v.id));
    for (const entry of entries) {
      if (entry.id && !existingIds.has(entry.id)) {
        throw new BadRequestException(`Variant #${entry.id} not found on product #${productId}`);
      }
    }

    const incomingIds = new Set(entries.filter((e) => e.id).map((e) => e.id));
    return { entries, toDiscontinue: existing.filter((v) => !incomingIds.has(v.id)) };
  }

  private async applyVariantSync(tx: Prisma.TransactionClient, productId: string, plan: VariantSyncPlan) {
    for (const entry of plan.entries) {
      const { id, ...fields } = entry;
      if (id) {
        await tx.productVariant.update({ where: { id }, data: fields });
      } else {
        const created = await tx.productVariant.create({ data: { ...(fields as CreateVariantDto), productId } });
        await tx.inventory.create({ data: { variantId: created.id, quantity: 0, reservedQuantity: 0 } });
      }
    }
    for (const variant of plan.toDiscontinue) {
      await tx.productVariant.update({ where: { id: variant.id }, data: { status: VariantStatus.DISCONTINUED } });
    }
  }

  async remove(id: string): Promise<void> {
    const current = await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
    // Row ảnh đã cascade theo product; object trên storage dọn best-effort.
    await this.productImagesService.discardUrls(current.images.map((image) => image.url));
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
