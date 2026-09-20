import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import type { Category } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const slug = slugify(createCategoryDto.name, { lower: true, locale: 'vi', strict: true });

    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) {
      // Duplicate name (=> duplicate slug) is rejected outright — never
      // auto-append a numeric suffix (design decision: no silent renaming).
      throw new ConflictException(`Category name "${createCategoryDto.name}" already exists`);
    }

    return this.prisma.category.create({ data: { ...createCategoryDto, slug } });
  }

  async findAll(pagination: PaginationDto) {
    const { page, limit } = pagination;
    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        skip: (page - 1) * limit,
        take: limit,
        // createdAt can collide within the same millisecond — id is always
        // added as a tie-breaker so pagination stays deterministic.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.category.count(),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    await this.findOne(id); // 404 pre-fetch — also needed below for the slug-collision check

    const data: UpdateCategoryDto & { slug?: string } = { ...updateCategoryDto };
    if (updateCategoryDto.name) {
      const slug = slugify(updateCategoryDto.name, { lower: true, locale: 'vi', strict: true });
      const existing = await this.prisma.category.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Category name "${updateCategoryDto.name}" already exists`);
      }
      data.slug = slug;
    }

    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    // ADR 0001: products.categoryId -> categories.id is RESTRICT at the DB
    // level. Pre-check and return a clear 409 with the blocking count
    // instead of letting a raw FK violation (P2003) surface as a 500.
    const productCount = await this.prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new ConflictException(`Category still has ${productCount} product(s) — reassign them before deleting`);
    }

    await this.prisma.category.delete({ where: { id } });
  }
}
