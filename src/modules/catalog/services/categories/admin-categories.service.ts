import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '#src/generated/prisma/client.js';
import type { Category } from '#src/generated/prisma/client.js';
import { writeUnique } from '#src/common/utils/prisma-error.util.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CreateCategoryDto } from '#src/modules/catalog/dto/categories/create-category.dto.js';
import { UpdateCategoryDto } from '#src/modules/catalog/dto/categories/update-category.dto.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { NEWEST_FIRST, paginate, Paginated } from '#src/common/pagination/paginate.js';
import { toSlugOrThrow } from '#src/common/utils/slug.util.js';

/**
 * Back-office danh mục (STAFF đọc, ADMIN ghi). Cây nhiều cấp với hai bất biến
 * (ADR 0001): không có vòng lặp, và không xoá được danh mục còn con hoặc còn
 * sản phẩm. Service kiểm tra trước để trả lỗi rõ ràng; FK RESTRICT ở DB là
 * lưới an toàn.
 */
@Injectable()
export class AdminCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    if (dto.parentId) await this.assertExists(dto.parentId, 'Parent category');
    const slug = await this.uniqueSlug(dto.name);

    return writeUnique(
      () => this.prisma.category.create({ data: { ...dto, slug } }),
      'slug',
      `Category name "${dto.name}" already exists`,
    );
  }

  findAll({ page, limit }: PaginationDto): Promise<Paginated<Category>> {
    return paginate(
      page,
      limit,
      (args) => this.prisma.category.findMany({ orderBy: [...NEWEST_FIRST], ...args }),
      () => this.prisma.category.count(),
    );
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    // Pre-fetch để đổi 1 id không tồn tại trả 404, không rơi xuống nhánh 409
    // (trùng tên) hay 400 (vòng lặp).
    await this.findOne(id);

    if (dto.parentId) await this.assertNoCycle(id, dto.parentId);

    const data: Prisma.CategoryUncheckedUpdateInput = { ...dto };
    if (dto.name) {
      data.slug = await this.uniqueSlug(dto.name, id);
    }

    return writeUnique(
      () => this.prisma.category.update({ where: { id }, data }),
      'slug',
      `Category name "${dto.name}" already exists`,
    );
  }

  async remove(id: string): Promise<void> {
    // Không pre-fetch để xác nhận tồn tại: delete() ném P2025, filter map 404.
    const [childCount, productCount] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      // Mọi trạng thái, kể cả ARCHIVED: sản phẩm không bao giờ mất danh mục.
      this.prisma.product.count({ where: { categoryId: id } }),
    ]);
    if (childCount > 0) {
      throw new ConflictException(`Category still has ${childCount} subcategory(ies) — move or delete them first`);
    }
    if (productCount > 0) {
      throw new ConflictException(`Category still has ${productCount} product(s) — reassign them before deleting`);
    }

    // TOCTOU: request khác có thể gắn con/sản phẩm ngay sau pre-check — chỉ FK
    // RESTRICT (P2003) chặn được thật; dịch sang cùng lỗi 409.
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictException('Category still has subcategories or products — move them before deleting');
      }
      throw err;
    }
  }

  /**
   * Đi ngược chuỗi tổ tiên của parent mới: gặp chính danh mục đang sửa nghĩa
   * là nó sẽ thành tổ tiên của chính mình → 400. Parent không tồn tại → 404.
   */
  private async assertNoCycle(id: string, newParentId: string): Promise<void> {
    if (newParentId === id) {
      throw new BadRequestException('A category cannot be its own parent');
    }
    await this.assertExists(newParentId, 'Parent category');

    const seen = new Set<string>();
    let cursor: string | null = newParentId;
    while (cursor) {
      if (cursor === id) {
        throw new BadRequestException('Moving the category under its own descendant would create a cycle');
      }
      if (seen.has(cursor)) break; // dữ liệu hỏng có sẵn vòng — không lặp vô hạn
      seen.add(cursor);
      const parent: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }

  private async assertExists(id: string, label: string): Promise<void> {
    const found = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!found) {
      throw new NotFoundException(`${label} #${id} not found`);
    }
  }

  /** Pre-check trùng tên cho message rõ ràng; unique constraint vẫn là chốt chặn thật. */
  private async uniqueSlug(name: string, selfId?: string): Promise<string> {
    const slug = toSlugOrThrow(name, 'Category');
    // Trùng tên (=> trùng slug) bị từ chối thẳng — không tự thêm hậu tố số.
    const existing = await this.prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (existing && existing.id !== selfId) {
      throw new ConflictException(`Category name "${name}" already exists`);
    }
    return slug;
  }
}
