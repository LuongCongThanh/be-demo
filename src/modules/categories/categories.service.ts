import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { Prisma } from '../../generated/prisma/client.js';
import type { Category } from '../../generated/prisma/client.js';
import { writeUnique } from '../../common/prisma-error.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const slug = this.toSlug(createCategoryDto.name);

    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) {
      // Trùng tên (=> trùng slug) bị từ chối thẳng — không tự thêm hậu tố số
      // (quyết định thiết kế: không âm thầm đổi tên client gửi lên).
      throw new ConflictException(`Category name "${createCategoryDto.name}" already exists`);
    }

    return writeUnique(
      () => this.prisma.category.create({ data: { ...createCategoryDto, slug } }),
      'slug',
      `Category name "${createCategoryDto.name}" already exists`,
    );
  }

  async findAll(pagination: PaginationDto) {
    const { page, limit } = pagination;
    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        skip: (page - 1) * limit,
        take: limit,
        // createdAt có thể trùng nhau trong cùng 1 millisecond — luôn thêm
        // id làm tie-breaker để thứ tự phân trang ổn định, xác định.
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
    // Pre-fetch cần thiết ở đây (khác với remove()): phải biết category có
    // tồn tại hay không TRƯỚC khi check trùng slug, để đảm bảo thứ tự lỗi
    // đúng — đổi tên 1 id không tồn tại phải trả 404, không được rơi xuống
    // nhánh 409 (trùng tên) chỉ vì chưa kiểm tra tồn tại trước.
    await this.findOne(id);

    const data: UpdateCategoryDto & { slug?: string } = { ...updateCategoryDto };
    if (updateCategoryDto.name) {
      const slug = this.toSlug(updateCategoryDto.name);
      const existing = await this.prisma.category.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Category name "${updateCategoryDto.name}" already exists`);
      }
      data.slug = slug;
    }

    // Nhánh P2002-trên-'slug' trong writeUnique() chỉ có thể trigger khi
    // data.slug được set ở trên, tức updateCategoryDto.name luôn có giá trị
    // ở đây — message dưới đây không bao giờ in "undefined".
    return writeUnique(
      () => this.prisma.category.update({ where: { id }, data }),
      'slug',
      `Category name "${updateCategoryDto.name}" already exists`,
    );
  }

  async remove(id: string): Promise<void> {
    // Không pre-fetch chỉ để xác nhận tồn tại — nếu id không tồn tại,
    // prisma.category.delete() bên dưới tự ném P2025, đã được
    // AllExceptionsFilter map sẵn thành 404 (khác update() ở trên, vì ở đây
    // không có nhánh 409 nào khác cần xác định thứ tự lỗi trước).
    const productCount = await this.prisma.product.count({ where: { categoryId: id } });

    // ADR 0001: products.categoryId -> categories.id là RESTRICT ở tầng DB.
    // Pre-check và trả 409 rõ ràng kèm số lượng đang chặn, thay vì để lỗi
    // FK (P2003) thô rơi xuống thành thông báo khó hiểu.
    if (productCount > 0) {
      throw new ConflictException(`Category still has ${productCount} product(s) — reassign them before deleting`);
    }

    // TOCTOU: pre-check ở trên thấy 0 product, nhưng 1 request khác có thể
    // tạo/gán product vào category này ngay trước dòng delete() bên dưới —
    // pre-check không bắt được race window này, chỉ FK constraint (P2003) ở
    // DB mới chặn được thật. Dịch nó thành cùng 1 lỗi 409 thân thiện như
    // pre-check, thay vì để rơi xuống message generic của AllExceptionsFilter.
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictException('Category still has product(s) — reassign them before deleting');
      }
      throw err;
    }
  }

  private toSlug(name: string): string {
    const slug = slugify(name, { lower: true, locale: 'vi', strict: true });
    // Tên chỉ gồm ký tự đặc biệt/dấu câu (vd. "!!!") vẫn qua được @IsNotEmpty()
    // (đã trim ở DTO) nhưng slugify trả về "" — nếu cho lọt qua, category đầu
    // tiên kiểu này sẽ có slug rỗng và mọi tên "vô nghĩa" sau đó sẽ bị báo
    // trùng tên (409) dù nhìn không giống nhau chút nào.
    if (!slug) {
      throw new BadRequestException(`Category name "${name}" does not produce a valid slug`);
    }
    return slug;
  }
}
