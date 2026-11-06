import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '#src/generated/prisma/client.js';
import { PrismaService } from '#src/prisma/prisma.service.js';
import { AdminCategoriesService } from '#src/categories/admin-categories.service.js';

describe('AdminCategoriesService', () => {
  let service: AdminCategoriesService;
  const prismaMock = {
    category: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    product: {
      count: vi.fn(),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AdminCategoriesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(AdminCategoriesService);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('generates a slug from name and creates the category', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);
      prismaMock.category.create.mockResolvedValue({ id: '1', name: 'Shoes', slug: 'shoes', description: null });

      const result = await service.create({ name: 'Shoes' });

      expect(prismaMock.category.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'shoes' } }),
      );
      expect(prismaMock.category.create).toHaveBeenCalledWith({ data: { name: 'Shoes', slug: 'shoes' } });
      expect(result.slug).toBe('shoes');
    });

    it('throws ConflictException when the generated slug already exists', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'existing', name: 'Shoes', slug: 'shoes' });

      await expect(service.create({ name: 'Shoes' })).rejects.toThrow(ConflictException);
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });

    // Tên chỉ gồm ký tự đặc biệt/dấu câu (vd. "!!!") không bị @IsNotEmpty()
    // chặn (đã trim ở DTO, chuỗi trimmed không rỗng) nhưng slugify() trả về
    // "" — phải chặn ở service, nếu không category đầu tiên kiểu này sẽ có
    // slug rỗng và mọi tên "vô nghĩa" khác sau đó bị báo trùng tên sai.
    it('throws BadRequestException when name produces an empty slug', async () => {
      await expect(service.create({ name: '!!!' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.category.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when create() races another request past the pre-check and hits P2002 on slug', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null); // pre-check passes
      prismaMock.category.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['slug'] },
        }),
      );

      await expect(service.create({ name: 'Shoes' })).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns paginated data with meta', async () => {
      prismaMock.category.findMany.mockResolvedValue([{ id: '1', name: 'Shoes', slug: 'shoes' }]);
      prismaMock.category.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(prismaMock.category.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      expect(result).toEqual({
        data: [{ id: '1', name: 'Shoes', slug: 'shoes' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it('computes the correct skip for page > 1', async () => {
      prismaMock.category.findMany.mockResolvedValue([]);
      prismaMock.category.count.mockResolvedValue(45);

      await service.findAll({ page: 3, limit: 20 });

      expect(prismaMock.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
    });
  });

  describe('findOne', () => {
    it('returns the category when found', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: '1', name: 'Shoes', slug: 'shoes' });
      const result = await service.findOne('1');
      expect(result).toEqual({ id: '1', name: 'Shoes', slug: 'shoes' });
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('regenerates the slug when name changes', async () => {
      prismaMock.category.findUnique
        .mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' }) // findOne() pre-fetch
        .mockResolvedValueOnce(null); // slug uniqueness check
      prismaMock.category.update.mockResolvedValue({ id: '1', name: 'Sneakers', slug: 'sneakers' });

      const result = await service.update('1', { name: 'Sneakers' });

      expect(prismaMock.category.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'Sneakers', slug: 'sneakers' },
      });
      expect(result.slug).toBe('sneakers');
    });

    it('throws ConflictException when the new name collides with a different category', async () => {
      prismaMock.category.findUnique
        .mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' })
        .mockResolvedValueOnce({ id: '2', name: 'Sneakers', slug: 'sneakers' });

      await expect(service.update('1', { name: 'Sneakers' })).rejects.toThrow(ConflictException);
    });

    it('does not touch the slug when name is not part of the update', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' });
      prismaMock.category.update.mockResolvedValue({ id: '1', name: 'Shoes', slug: 'shoes', description: 'Updated' });

      await service.update('1', { description: 'Updated' });

      expect(prismaMock.category.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { description: 'Updated' },
      });
    });

    it('throws NotFoundException when the category does not exist', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce(null);
      await expect(service.update('missing-id', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the new name produces an empty slug', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' }); // findOne() pre-fetch

      await expect(service.update('1', { name: '!!!' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.category.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when update() races another request past the pre-check and hits P2002 on slug', async () => {
      prismaMock.category.findUnique
        .mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' }) // findOne() pre-fetch
        .mockResolvedValueOnce(null); // slug uniqueness pre-check passes
      prismaMock.category.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['slug'] },
        }),
      );

      await expect(service.update('1', { name: 'Sneakers' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      prismaMock.category.count.mockResolvedValue(0); // không có danh mục con
    });

    it('throws ConflictException when the category still has subcategories', async () => {
      prismaMock.category.count.mockResolvedValue(2);
      prismaMock.product.count.mockResolvedValue(0);

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
      expect(prismaMock.category.delete).not.toHaveBeenCalled();
    });

    it('deletes the category when no products reference it', async () => {
      prismaMock.product.count.mockResolvedValue(0);
      prismaMock.category.delete.mockResolvedValue(undefined);

      await service.remove('1');

      expect(prismaMock.product.count).toHaveBeenCalledWith({ where: { categoryId: '1' } });
      expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('throws ConflictException when products still reference the category', async () => {
      prismaMock.product.count.mockResolvedValue(3);

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
      expect(prismaMock.category.delete).not.toHaveBeenCalled();
    });

    // Không pre-fetch findOne() trước khi xoá (khác update()) — nếu id
    // không tồn tại, prisma.category.delete() tự ném lỗi not-found (P2025
    // ở DB thật), và remove() phải để lỗi đó truyền nguyên vẹn lên trên cho
    // AllExceptionsFilter tự map thành 404, không được nuốt hay che lỗi.
    it('propagates the error from delete() untouched when the category does not exist', async () => {
      prismaMock.product.count.mockResolvedValue(0);
      const notFoundError = new Error('Record not found');
      prismaMock.category.delete.mockRejectedValue(notFoundError);

      await expect(service.remove('missing-id')).rejects.toThrow(notFoundError);
    });

    // TOCTOU: product.count() thấy 0, nhưng 1 product mới được tạo/gán vào
    // category này ngay trước khi delete() chạy — pre-check không bắt được
    // race window này, chỉ FK constraint (P2003) ở DB mới chặn được thật.
    it('throws ConflictException when delete() races a concurrent insert and hits P2003', async () => {
      prismaMock.product.count.mockResolvedValue(0); // pre-check thấy 0, race xảy ra ngay sau đó
      prismaMock.category.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
          code: 'P2003',
          clientVersion: 'test',
        }),
      );

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
    });
  });

  describe('tree rules (ADR 0001)', () => {
    it('create rejects an unknown parent with 404', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce(null);
      await expect(service.create({ name: 'Ao', parentId: 'missing' })).rejects.toThrow(NotFoundException);
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });

    it('update rejects making a category its own parent', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce({ id: 'a' });
      await expect(service.update('a', { parentId: 'a' })).rejects.toThrow(BadRequestException);
    });

    it('update rejects moving a category under its own descendant (a → b → c, move a under c)', async () => {
      const parents: Record<string, string | null> = { c: 'b', b: 'a', a: null };
      prismaMock.category.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id in parents ? { id: where.id, parentId: parents[where.id] } : null,
      );

      await expect(service.update('a', { parentId: 'c' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.category.update).not.toHaveBeenCalled();
    });

    it('update allows moving to an unrelated parent and back to root', async () => {
      const parents: Record<string, string | null> = { a: null, x: null };
      prismaMock.category.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id in parents ? { id: where.id, parentId: parents[where.id] } : null,
      );
      prismaMock.category.update.mockResolvedValue({ id: 'a' });

      await service.update('a', { parentId: 'x' });
      await service.update('a', { parentId: null });

      expect(prismaMock.category.update).toHaveBeenCalledTimes(2);
    });

    it('update stops walking on already-corrupt cyclic data instead of looping forever', async () => {
      const parents: Record<string, string | null> = { a: null, x: 'y', y: 'x' };
      prismaMock.category.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id in parents ? { id: where.id, parentId: parents[where.id] } : null,
      );
      prismaMock.category.update.mockResolvedValue({ id: 'a' });

      await expect(service.update('a', { parentId: 'x' })).resolves.toEqual({ id: 'a' });
    });
  });
});
