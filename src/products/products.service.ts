import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import type { Product } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

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

  findAll() {
    return `This action returns all products`;
  }

  findOne(id: number) {
    return `This action returns a #${id} product`;
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return `This action updates a #${id} product`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }
}
