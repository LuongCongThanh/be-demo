import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import type { Product } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const category = await this.prisma.category.findUnique({ where: { id: createProductDto.categoryId } });
    if (!category) {
      throw new NotFoundException(`Category #${createProductDto.categoryId} not found`);
    }

    const slug = slugify(createProductDto.name, { lower: true, locale: 'vi', strict: true });
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Product name "${createProductDto.name}" already exists`);
    }

    return this.prisma.product.create({ data: { ...createProductDto, slug } });
  }

  async findAll({ page, limit, categoryId, status }: ListProductsQueryDto) {
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
      const slug = slugify(updateProductDto.name, { lower: true, locale: 'vi', strict: true });
      const existing = await this.prisma.product.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Product name "${updateProductDto.name}" already exists`);
      }
      data.slug = slug;
    }

    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }
}
