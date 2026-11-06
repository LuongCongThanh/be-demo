import { Injectable } from '@nestjs/common';
import type { Color, Size } from '#src/generated/prisma/client.js';
import { writeUnique } from '#src/common/prisma-error.util.js';
import { PrismaService } from '#src/prisma/prisma.service.js';
import { CreateSizeDto } from '#src/product-options/dto/create-size.dto.js';
import { UpdateSizeDto } from '#src/product-options/dto/update-size.dto.js';
import { CreateColorDto } from '#src/product-options/dto/create-color.dto.js';
import { UpdateColorDto } from '#src/product-options/dto/update-color.dto.js';

const SIZE_FIELDS = { id: true, code: true, name: true, sortOrder: true, isHidden: true } as const;
const COLOR_FIELDS = { id: true, code: true, name: true, hex: true, isHidden: true } as const;

/**
 * Danh sách size và bảng màu dùng chung (BR-CAT-11). Không có xoá: biến thể
 * tham chiếu bằng FK RESTRICT — muốn bỏ một lựa chọn thì ẩn (`isHidden`).
 * Mã trùng → 409 (P2002 trên `code`, không cần pre-check riêng). Không tồn tại
 * → 404 do AllExceptionsFilter map P2025.
 */
@Injectable()
export class ProductOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  listSizes(includeHidden: boolean): Promise<Omit<Size, 'createdAt' | 'updatedAt'>[]> {
    return this.prisma.size.findMany({
      where: includeHidden ? {} : { isHidden: false },
      select: SIZE_FIELDS,
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  createSize(dto: CreateSizeDto) {
    return writeUnique(
      () => this.prisma.size.create({ data: dto, select: SIZE_FIELDS }),
      'code',
      `Size code "${dto.code}" already exists`,
    );
  }

  updateSize(id: string, dto: UpdateSizeDto) {
    return this.prisma.size.update({ where: { id }, data: dto, select: SIZE_FIELDS });
  }

  listColors(includeHidden: boolean): Promise<Omit<Color, 'createdAt' | 'updatedAt'>[]> {
    return this.prisma.color.findMany({
      where: includeHidden ? {} : { isHidden: false },
      select: COLOR_FIELDS,
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });
  }

  createColor(dto: CreateColorDto) {
    return writeUnique(
      () => this.prisma.color.create({ data: { ...dto, hex: dto.hex.toUpperCase() }, select: COLOR_FIELDS }),
      'code',
      `Color code "${dto.code}" already exists`,
    );
  }

  updateColor(id: string, dto: UpdateColorDto) {
    const data = { ...dto, ...(dto.hex && { hex: dto.hex.toUpperCase() }) };
    return this.prisma.color.update({ where: { id }, data, select: COLOR_FIELDS });
  }
}
