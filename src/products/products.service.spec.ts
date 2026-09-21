import { NotFoundException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductsService } from './products.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ProductsService', () => {
  let service: ProductsService;
  const prismaMock = {
    category: { findUnique: vi.fn() },
    product: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productVariant: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(ProductsService);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('ném NotFoundException khi categoryId không tồn tại', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);

      await expect(service.create({ name: 'Áo thun', categoryId: 'missing-category-id' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it('ném ConflictException khi trùng slug', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prismaMock.product.findUnique.mockResolvedValue({ id: 'existing-product', slug: 'ao-thun' });

      await expect(service.create({ name: 'Áo Thun', categoryId: 'cat-1' })).rejects.toThrow(ConflictException);
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it('sinh đúng slug từ name và gọi prisma.product.create', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue({ id: 'p1', name: 'Áo Thun', slug: 'ao-thun', categoryId: 'cat-1' });

      const result = await service.create({ name: 'Áo Thun', categoryId: 'cat-1' });

      expect(prismaMock.product.create).toHaveBeenCalledWith({
        data: { name: 'Áo Thun', categoryId: 'cat-1', slug: 'ao-thun' },
      });
      expect(result.slug).toBe('ao-thun');
    });
  });

  describe('findOne', () => {
    it('ném NotFoundException khi không tìm thấy', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('sinh lại slug khi đổi name, chặn trùng (loại trừ chính record đang sửa)', async () => {
      prismaMock.product.findUnique
        .mockResolvedValueOnce({ id: 'p1', name: 'Áo cũ', slug: 'ao-cu', categoryId: 'cat-1' }) // pre-fetch trong update()
        .mockResolvedValueOnce({ id: 'p1', slug: 'ao-moi' }); // check trùng slug mới — trùng chính nó, phải bỏ qua
      prismaMock.product.update.mockResolvedValue({ id: 'p1', name: 'Áo mới', slug: 'ao-moi' });

      const result = await service.update('p1', { name: 'Áo mới' });

      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { name: 'Áo mới', slug: 'ao-moi' },
      });
      expect(result.slug).toBe('ao-moi');
    });
  });

  describe('remove', () => {
    it('xoá product sau khi xác nhận tồn tại', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' });
      await service.remove('p1');
      expect(prismaMock.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
  });
});
