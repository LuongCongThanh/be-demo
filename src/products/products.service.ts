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
import { ProductImagesService } from './product-images.service.js';
import { ProductVariantsService } from './product-variants.service.js';

// `images` luôn sắp theo sort_order (images[0] là Cover Image) và giấu
// sort_order khỏi response — thứ tự mảng đã là thông tin duy nhất client cần.
// Variant nhúng Option Value dạng { id, name, code } thay cho colorId/sizeId trần.
const OPTION_VALUE_SUMMARY = { select: { id: true, name: true, code: true } } as const;
const VARIANT_SHAPE = {
  include: { color: OPTION_VALUE_SUMMARY, size: OPTION_VALUE_SUMMARY },
  omit: { colorId: true, sizeId: true },
} as const;
const PRODUCT_INCLUDE = {
  variants: VARIANT_SHAPE,
  images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], omit: { sortOrder: true } },
} satisfies Prisma.ProductInclude;

// Read public chỉ thấy variant ACTIVE; staff (includeAllVariants) và mọi
// response của thao tác ghi thấy đủ.
function productInclude(includeAllVariants: boolean) {
  return includeAllVariants
    ? PRODUCT_INCLUDE
    : { ...PRODUCT_INCLUDE, variants: { ...VARIANT_SHAPE, where: { status: VariantStatus.ACTIVE } } };
}

type OptionValueSummary = Prisma.OptionValueGetPayload<typeof OPTION_VALUE_SUMMARY>;
type ProductWithRelations = Product & {
  variants: (Omit<ProductVariant, 'colorId' | 'sizeId'> & {
    color: OptionValueSummary | null;
    size: OptionValueSummary | null;
  })[];
  images: Omit<ProductImage, 'sortOrder'>[];
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productImagesService: ProductImagesService,
    private readonly productVariantsService: ProductVariantsService,
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

    const existingCode = await this.prisma.product.findUnique({ where: { code: productFields.code } });
    if (existingCode) {
      throw new ConflictException(`Product code "${productFields.code}" already exists`);
    }

    // Sinh id trước transaction — ảnh được copy sang `products/<productId>/`
    // trong plan() (gọi mạng, phải chạy ngoài transaction), lúc đó product
    // chưa tồn tại. Chạy sau các pre-check rẻ ở trên để 404/409 không tốn copy.
    const productId = randomUUID();
    const variantPlan = await this.productVariantsService.plan(
      { id: productId, code: productFields.code },
      [],
      variants ?? [],
    );
    const imagePlan = images?.length ? await this.productImagesService.plan(productId, [], images) : undefined;

    // Product + variants + inventory (quantity=0) + images phải cùng thành
    // công hoặc cùng thất bại như 1 đơn vị — không có trạng thái "product đã
    // tạo nhưng thiếu vài variant/ảnh".
    return this.productImagesService.commit(imagePlan, () =>
      writeUnique(
        () =>
          this.prisma.$transaction(async (tx) => {
            await tx.product.create({ data: { ...productFields, id: productId, slug } });
            await this.productVariantsService.apply(tx, productId, variantPlan);
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

  async findAll({ page, limit, categoryId, status, includeAllVariants = false }: ListProductsQueryDto): Promise<{
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
        include: productInclude(includeAllVariants),
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, includeAllVariants = false): Promise<ProductWithRelations> {
    // Embed sẵn variants + images (không có endpoint con). Mặc định chỉ variant
    // ACTIVE; staff/đường ghi truyền includeAllVariants để thấy đủ — xem
    // docs/specs/03-products.md, mục Reads.
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude(includeAllVariants),
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<ProductWithRelations> {
    const current = await this.findOne(id, true);

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

    const variantPlan = variants
      ? await this.productVariantsService.plan(current, await this.variantRows(id), variants)
      : undefined;
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
                  await this.productVariantsService.apply(tx, id, variantPlan);
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

    return this.findOne(id, true);
  }

  // Row variant thật (có colorId/sizeId) — response của findOne() đã thay
  // chúng bằng Option Value nhúng.
  private variantRows(productId: string): Promise<ProductVariant[]> {
    return this.prisma.productVariant.findMany({ where: { productId } });
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
