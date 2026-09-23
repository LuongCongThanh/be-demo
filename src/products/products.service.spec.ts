import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
        include: { variants: true },
      });
      expect(result.slug).toBe('ao-thun');
    });

    it('finds all embeds variants for each product in the page', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.product.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { variants: true } }),
      );
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

    it('creates the product, its variants, and their inventory rows in the same transaction', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.productVariant.findUnique.mockResolvedValue(null);

      const createdProduct = { id: 'p1', name: 'Áo Thun', slug: 'ao-thun', categoryId: 'cat-1' };
      const createdVariant = { id: 'v1', productId: 'p1', sku: 'SKU-1', price: 100000 };
      const txProductCreate = vi.fn().mockResolvedValue(createdProduct);
      const txProductFindUnique = vi.fn().mockResolvedValue({ ...createdProduct, variants: [createdVariant] });
      const txVariantCreate = vi.fn().mockResolvedValue(createdVariant);
      const txInventoryCreate = vi.fn().mockResolvedValue({ id: 'inv1', variantId: 'v1', quantity: 0 });
      prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({
          product: { create: txProductCreate, findUnique: txProductFindUnique },
          productVariant: { create: txVariantCreate },
          inventory: { create: txInventoryCreate },
        }),
      );

      const result = await service.create({
        name: 'Áo Thun',
        categoryId: 'cat-1',
        variants: [{ sku: 'SKU-1', price: 100000 }],
      });

      expect(txProductCreate).toHaveBeenCalledWith({
        data: { name: 'Áo Thun', categoryId: 'cat-1', slug: 'ao-thun' },
      });
      expect(txVariantCreate).toHaveBeenCalledWith({ data: { sku: 'SKU-1', price: 100000, productId: 'p1' } });
      expect(txInventoryCreate).toHaveBeenCalledWith({ data: { variantId: 'v1', quantity: 0, reservedQuantity: 0 } });
      expect(result.variants).toEqual([{ id: 'v1', productId: 'p1', sku: 'SKU-1', price: 100000 }]);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('embeds variants (including discontinued) in the response', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1', variants: [{ id: 'v1', status: 'DISCONTINUED' }] });

      await service.findOne('p1');

      expect(prismaMock.product.findUnique).toHaveBeenCalledWith({ where: { id: 'p1' }, include: { variants: true } });
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
        include: { variants: true },
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

    it('leaves existing variants untouched when the variants field is omitted', async () => {
      prismaMock.product.findUnique.mockResolvedValueOnce({ id: 'p1', name: 'Áo', slug: 'ao', categoryId: 'cat-1' });
      prismaMock.product.update.mockResolvedValue({ id: 'p1', name: 'Áo mới' });

      await service.update('p1', { name: 'Áo mới' });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('reconciles a full variants array in one transaction: updates known ids, creates new entries, discontinues missing ones', async () => {
      prismaMock.product.findUnique
        .mockResolvedValueOnce({ id: 'p1', name: 'Áo', slug: 'ao', categoryId: 'cat-1' }) // pre-fetch trong update()
        .mockResolvedValueOnce({ id: 'p1', name: 'Áo', slug: 'ao', categoryId: 'cat-1', variants: [] }); // re-fetch cuối cùng để trả response
      prismaMock.productVariant.findMany.mockResolvedValue([
        { id: 'v-keep', productId: 'p1', sku: 'SKU-KEEP' },
        { id: 'v-retire', productId: 'p1', sku: 'SKU-RETIRE' },
      ]);

      const txVariantUpdate = vi.fn().mockResolvedValue({ id: 'v-keep', sku: 'SKU-KEEP', price: 150000 });
      const txVariantCreate = vi.fn().mockResolvedValue({ id: 'v-new', sku: 'SKU-NEW', price: 90000 });
      const txInventoryCreate = vi.fn().mockResolvedValue({ id: 'inv-new', variantId: 'v-new' });
      prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({
          productVariant: { update: txVariantUpdate, create: txVariantCreate },
          inventory: { create: txInventoryCreate },
        }),
      );

      await service.update('p1', {
        variants: [
          { id: 'v-keep', sku: 'SKU-KEEP', price: 150000 },
          { sku: 'SKU-NEW', price: 90000 },
        ],
      });

      expect(txVariantUpdate).toHaveBeenCalledWith({
        where: { id: 'v-keep' },
        data: { sku: 'SKU-KEEP', price: 150000 },
      });
      expect(txVariantCreate).toHaveBeenCalledWith({ data: { sku: 'SKU-NEW', price: 90000, productId: 'p1' } });
      expect(txInventoryCreate).toHaveBeenCalledWith({
        data: { variantId: 'v-new', quantity: 0, reservedQuantity: 0 },
      });
      expect(txVariantUpdate).toHaveBeenCalledWith({ where: { id: 'v-retire' }, data: { status: 'DISCONTINUED' } });
    });

    it('rejects a variants entry whose id does not belong to this product', async () => {
      prismaMock.product.findUnique.mockResolvedValueOnce({ id: 'p1', name: 'Áo', slug: 'ao', categoryId: 'cat-1' });
      prismaMock.productVariant.findMany.mockResolvedValue([]);

      await expect(service.update('p1', { variants: [{ id: 'foreign-variant', sku: 'X', price: 1 }] })).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the product after confirming it exists', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' });
      await service.remove('p1');
      expect(prismaMock.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
  });

  describe('findAllVariants', () => {
    it('filters by status when provided', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' });
      prismaMock.productVariant.findMany.mockResolvedValue([]);
      prismaMock.productVariant.count.mockResolvedValue(0);

      await service.findAllVariants('p1', { page: 1, limit: 10, status: 'ACTIVE' });

      expect(prismaMock.productVariant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { productId: 'p1', status: 'ACTIVE' } }),
      );
    });
  });

  describe('findOneVariant', () => {
    it('throws NotFoundException when the variant does not exist or does not belong to this product', async () => {
      // findOneVariant() chỉ query productVariant.findFirst({ where: { id, productId } })
      // — không cần product.findUnique riêng, vì where đã lọc theo cả 2 điều kiện cùng lúc.
      prismaMock.productVariant.findFirst.mockResolvedValue(null);

      await expect(service.findOneVariant('p1', 'missing-variant')).rejects.toThrow(NotFoundException);
    });
  });
});
