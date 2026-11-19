import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '#src/generated/prisma/client.js';
import {
  categoryTranslations,
  type CategoryWithTranslations,
} from '#src/modules/catalog/category/category-response.mapper.js';
import { writeUnique } from '#src/infrastructure/database/prisma-error.util.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CreateCategoryDto } from '#src/modules/catalog/category/dto/create-category.dto.js';
import { UpdateCategoryDto } from '#src/modules/catalog/category/dto/update-category.dto.js';
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
export class AdminCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto): Promise<CategoryWithTranslations> {
    if (dto.parentId) await this.assertExists(dto.parentId, 'Parent category');
    const slug = await this.uniqueSlug(dto.name);

    const { nameEn, ...input } = dto;
    return writeUnique(
      () =>
        this.prisma.category.create({
          data: {
            ...input,
            slug,
            translations: { create: { locale: 'en', name: nameEn ?? null, status: nameEn ? 'MANUAL' : 'PENDING' } },
          },
          include: categoryTranslations,
        }),
      'slug',
      `Category name "${dto.name}" already exists`,
    );
  }

  findAll({ page, limit }: PaginationDto): Promise<Paginated<CategoryWithTranslations>> {
    return paginate(
      page,
      limit,
      (args) => this.prisma.category.findMany({ orderBy: [...NEWEST_FIRST], ...args, include: categoryTranslations }),
      () => this.prisma.category.count(),
    );
  }

  async findOne(id: string, db: Prisma.TransactionClient = this.prisma): Promise<CategoryWithTranslations> {
    const category = await db.category.findUnique({ where: { id }, include: categoryTranslations });
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryWithTranslations> {
    if (dto.parentId === undefined) return this.updateContent(this.prisma, id, dto);
    // Serialize tree moves across instances. Opposing concurrent moves must not both pass the cycle check.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(724061319)::text`;
      return this.updateContent(tx, id, dto);
    });
  }

  private async updateContent(
    db: Prisma.TransactionClient,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryWithTranslations> {
    // Read the editorial state and revision before validating a tree move.
    const current = await this.findOne(id, db);

    if (dto.parentId) await this.assertNoCycle(id, dto.parentId, db);

    const { nameEn, ...input } = dto;
    const english = current.translations.find((translation) => translation.locale === 'en')!;
    const renamed = dto.name !== undefined && dto.name !== current.name;
    const data: Prisma.CategoryUncheckedUpdateInput = { ...input };
    if (renamed) data.sourceVersion = { increment: 1 };
    if (nameEn !== undefined || renamed) {
      const manual = english.status === 'MANUAL' || english.status === 'REVIEW';
      data.translations = {
        update: {
          where: { categoryId_locale: { categoryId: id, locale: 'en' }, revision: english.revision },
          data: {
            ...(nameEn !== undefined
              ? { name: nameEn, status: nameEn === null ? 'PENDING' : 'MANUAL' }
              : manual
                ? { status: 'REVIEW' }
                : { name: null, status: 'PENDING' }),
            sourceVersion: current.sourceVersion + (renamed ? 1 : 0),
            revision: { increment: 1 },
            leaseUntil: null,
          },
        },
      };
    }
    // The nested write is atomic. Both source and translation revisions revoke stale edits/results.
    return db.category
      .update({
        where: {
          id,
          sourceVersion: current.sourceVersion,
          translations: { some: { locale: 'en', revision: english.revision } },
        },
        data,
        include: categoryTranslations,
      })
      .catch(async (err: unknown) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          await this.findOne(id, db);
          throw new ConflictException('Category content changed concurrently — reload and retry');
        }
        throw err;
      });
  }

  async retryTranslation(id: string): Promise<CategoryWithTranslations> {
    // Atomic nested update keeps the current name and revokes each previous lease.
    return this.prisma.category.update({
      where: { id },
      data: {
        translations: {
          update: {
            where: { categoryId_locale: { categoryId: id, locale: 'en' } },
            data: { status: 'PENDING', revision: { increment: 1 }, leaseUntil: null },
          },
        },
      },
      include: categoryTranslations,
    });
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
  private async assertNoCycle(id: string, newParentId: string, db: Prisma.TransactionClient): Promise<void> {
    if (newParentId === id) {
      throw new BadRequestException('A category cannot be its own parent');
    }
    await this.assertExists(newParentId, 'Parent category', db);

    const seen = new Set<string>();
    let cursor: string | null = newParentId;
    while (cursor) {
      if (cursor === id) {
        throw new BadRequestException('Moving the category under its own descendant would create a cycle');
      }
      if (seen.has(cursor)) throw new BadRequestException('The destination category tree contains a cycle');
      seen.add(cursor);
      const parent: { parentId: string | null } | null = await db.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }

  private async assertExists(id: string, label: string, db: Prisma.TransactionClient = this.prisma): Promise<void> {
    const found = await db.category.findUnique({ where: { id }, select: { id: true } });
    if (!found) {
      throw new NotFoundException(`${label} #${id} not found`);
    }
  }

  /** Pre-check trùng tên cho message rõ ràng; unique constraint vẫn là chốt chặn thật. */
  private async uniqueSlug(name: string): Promise<string> {
    const slug = toSlugOrThrow(name, 'Category');
    // Trùng tên (=> trùng slug) bị từ chối thẳng — không tự thêm hậu tố số.
    const existing = await this.prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      throw new ConflictException(`Category name "${name}" already exists`);
    }
    return slug;
  }
}
