import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminProductsService } from '#src/products/admin-products.service.js';
import { PrismaService } from '#src/prisma/prisma.service.js';

describe('AdminProductsService', () => {
  let service: AdminProductsService;
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
      providers: [AdminProductsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(AdminProductsService);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('throws NotFoundException when categoryId does not exist', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);

      await expect(service.create({ name: 'Áo thun', categoryId: 'missing-category-id' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the slug already exists', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prismaMock.product.findUnique.mockResolvedValue({ id: 'existing-product', slug: 'ao-thun' });

      await expect(service.create({ name: 'Áo Thun', categoryId: 'cat-1' })).rejects.toThrow(ConflictException);
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it('generates the correct slug from name and calls prisma.product.create', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue({ id: 'p1', name: 'Áo Thun', slug: 'ao-thun', categoryId: 'cat-1' });

      const result = await service.create({ name: 'Áo Thun', categoryId: 'cat-1' });

      expect(prismaMock.product.create).toHaveBeenCalledWith({
        data: { name: 'Áo Thun', categoryId: 'cat-1', slug: 'ao-thun' },
      });
      expect(result.slug).toBe('ao-thun');
    });

    // Tên chỉ gồm ký tự đặc biệt/dấu câu (vd. "!!!") không bị @IsNotEmpty()
    // chặn (đã trim ở DTO, chuỗi trimmed không rỗng) nhưng slugify() trả về
    // "" — phải chặn ở service, nếu không product đầu tiên kiểu này sẽ có
    // slug rỗng và mọi tên "vô nghĩa" khác sau đó bị báo trùng tên sai.
    it('throws BadRequestException when name produces an empty slug', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'cat-1' });

      await expect(service.create({ name: '!!!', categoryId: 'cat-1' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.product.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('regenerates the slug when name changes, excluding the record being updated from the duplicate check', async () => {
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

    it('throws BadRequestException when the new name produces an empty slug', async () => {
      prismaMock.product.findUnique.mockResolvedValueOnce({
        id: 'p1',
        name: 'Áo cũ',
        slug: 'ao-cu',
        categoryId: 'cat-1',
      }); // findOne() pre-fetch trong update()

      await expect(service.update('p1', { name: '!!!' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.product.update).not.toHaveBeenCalled();
    });
  });

  describe('createVariant', () => {
    it('throws NotFoundException when productId does not exist', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(service.createVariant('missing-product-id', { sku: 'SKU-1', price: 100000 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the sku already exists', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' });
      prismaMock.productVariant.findUnique.mockResolvedValue({ id: 'existing-variant', sku: 'SKU-1' });

      await expect(service.createVariant('p1', { sku: 'SKU-1', price: 100000 })).rejects.toThrow(ConflictException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('creates the variant + inventory (quantity=0) in the same transaction', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' });
      prismaMock.productVariant.findUnique.mockResolvedValue(null);

      const createdVariant = { id: 'v1', productId: 'p1', sku: 'SKU-1', price: 100000 };
      const txVariantCreate = vi.fn().mockResolvedValue(createdVariant);
      const txInventoryCreate = vi
        .fn()
        .mockResolvedValue({ id: 'inv1', variantId: 'v1', quantity: 0, reservedQuantity: 0 });
      prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({ productVariant: { create: txVariantCreate }, inventory: { create: txInventoryCreate } }),
      );

      const result = await service.createVariant('p1', { sku: 'SKU-1', price: 100000 });

      expect(txVariantCreate).toHaveBeenCalledWith({ data: { sku: 'SKU-1', price: 100000, productId: 'p1' } });
      expect(txInventoryCreate).toHaveBeenCalledWith({ data: { variantId: 'v1', quantity: 0, reservedQuantity: 0 } });
      expect(result).toEqual(createdVariant);
    });
  });

  describe('updateVariant', () => {
    it('rejects a duplicate sku when changing sku, excluding the record being updated from the duplicate check', async () => {
      prismaMock.productVariant.findFirst.mockResolvedValueOnce({ id: 'v1', productId: 'p1', sku: 'SKU-OLD' });
      prismaMock.productVariant.findUnique.mockResolvedValueOnce({ id: 'v1', sku: 'SKU-NEW' });
      prismaMock.productVariant.update.mockResolvedValue({ id: 'v1', sku: 'SKU-NEW' });

      const result = await service.updateVariant('p1', 'v1', { sku: 'SKU-NEW' });

      expect(prismaMock.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { sku: 'SKU-NEW' },
      });
      expect(result.sku).toBe('SKU-NEW');
    });
  });
});
