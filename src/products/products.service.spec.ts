import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductsService } from '@src/products/products.service.js';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { ProductImagesService } from '@src/products/product-images.service.js';
import { ProductVariantsService } from '@src/products/product-variants.service.js';

// Chỉ giữ các nhánh e2e (test/products.e2e-spec.ts) không chạm tới được hoặc
// khó dựng: thứ tự pre-check (chặn trước khi tốn storage/transaction). Hành vi
// nghiệp vụ của aggregate (variant sync, SKU, ảnh, 404/409) test qua HTTP.
describe('ProductsService', () => {
  let service: ProductsService;
  const productImagesServiceMock = { plan: vi.fn(), apply: vi.fn(), commit: vi.fn(), discardUrls: vi.fn() };
  const productVariantsServiceMock = { plan: vi.fn(), apply: vi.fn() };
  const prismaMock = {
    category: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), create: vi.fn() },
    productVariant: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };

  const validCreate = {
    name: 'Áo Thun',
    code: 'TSB001',
    categoryId: 'cat-1',
    variants: [{ price: 1 }],
    images: [{ key: 'tmp/product-image/k1.jpg' }],
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ProductImagesService, useValue: productImagesServiceMock },
        { provide: ProductVariantsService, useValue: productVariantsServiceMock },
      ],
    }).compile();

    service = moduleRef.get(ProductsService);
    vi.clearAllMocks();
    prismaMock.product.findUnique.mockReset();
    // commit() thật chỉ bọc write() + dọn storage — mock chạy thẳng write().
    productImagesServiceMock.commit.mockImplementation((_plan: unknown, write: () => Promise<unknown>) => write());
  });

  describe('create', () => {
    // Tên chỉ gồm ký tự đặc biệt/dấu câu (vd. "!!!") không bị @IsNotEmpty()
    // chặn (đã trim ở DTO, chuỗi trimmed không rỗng) nhưng slugify() trả về
    // "" — phải chặn ở service, nếu không product đầu tiên kiểu này sẽ có
    // slug rỗng và mọi tên "vô nghĩa" khác sau đó bị báo trùng tên sai.
    it('throws BadRequestException when name produces an empty slug, before any write', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'cat-1' });

      await expect(service.create({ ...validCreate, name: '!!!' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.product.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('does not touch storage or plan variants when a cheap pre-check fails', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);

      await expect(service.create(validCreate)).rejects.toThrow(NotFoundException);
      expect(productImagesServiceMock.plan).not.toHaveBeenCalled();
      expect(productVariantsServiceMock.plan).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const current = {
      id: 'p1',
      name: 'Áo cũ',
      code: 'P1',
      slug: 'ao-cu',
      categoryId: 'cat-1',
      variants: [],
      images: [],
    };

    it('throws BadRequestException when the new name produces an empty slug', async () => {
      prismaMock.product.findUnique.mockResolvedValueOnce(current);

      await expect(service.update('p1', { name: '!!!' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('returns the current product without opening a transaction for an empty payload', async () => {
      prismaMock.product.findUnique.mockResolvedValueOnce(current);

      await expect(service.update('p1', {})).resolves.toBe(current);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('treats renaming a product to its own current slug as no conflict', async () => {
      prismaMock.product.findUnique
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce({ id: 'p1', slug: 'ao-moi' }) // slug mới trùng chính nó
        .mockResolvedValueOnce({ ...current, name: 'Áo mới', slug: 'ao-moi' });
      const txProductUpdate = vi.fn();
      prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({ product: { update: txProductUpdate } }),
      );

      const result = await service.update('p1', { name: 'Áo mới' });

      expect(txProductUpdate).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { name: 'Áo mới', slug: 'ao-moi' } });
      expect(result.slug).toBe('ao-moi');
    });
  });
});
