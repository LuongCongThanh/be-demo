import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductsService } from './products.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { ProductImagesService } from './product-images.service.js';

describe('ProductsService', () => {
  let service: ProductsService;
  const imagePlan = { rows: [], removedIds: [], removedUrls: [], promotedUrls: [], pendingKeys: [] };
  const productImagesServiceMock = {
    plan: vi.fn(),
    apply: vi.fn(),
    commit: vi.fn(),
    discardUrls: vi.fn(),
  };
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

  // Mọi write nhiều bước chạy trong 1 transaction — mock tx trả về đúng các
  // fn test cần assert.
  function mockTransaction(tx: Record<string, unknown>) {
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ProductImagesService, useValue: productImagesServiceMock },
      ],
    }).compile();

    service = moduleRef.get(ProductsService);
    vi.clearAllMocks();
    prismaMock.product.findUnique.mockReset();
    productImagesServiceMock.plan.mockResolvedValue(imagePlan);
    // commit() thật chỉ bọc write() + dọn storage — mock chạy thẳng write().
    productImagesServiceMock.commit.mockImplementation((_plan: unknown, write: () => Promise<unknown>) => write());
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

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Áo Thun', categoryId: 'cat-1', slug: 'ao-thun' } }),
      );
      expect(result.slug).toBe('ao-thun');
    });

    it('finds all embeds variants for each product in the page', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.product.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: expect.objectContaining({ variants: true }) }),
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

      const createdVariant = { id: 'v1', productId: 'p1', sku: 'SKU-1', price: 100000 };
      const txProductCreate = vi.fn().mockResolvedValue({ id: 'p1' });
      const txProductFindUnique = vi.fn().mockResolvedValue({ id: 'p1', variants: [createdVariant] });
      const txVariantCreate = vi.fn().mockResolvedValue(createdVariant);
      const txInventoryCreate = vi.fn().mockResolvedValue({ id: 'inv1', variantId: 'v1', quantity: 0 });
      mockTransaction({
        product: { create: txProductCreate, findUnique: txProductFindUnique },
        productVariant: { create: txVariantCreate },
        inventory: { create: txInventoryCreate },
      });

      const result = await service.create({
        name: 'Áo Thun',
        categoryId: 'cat-1',
        variants: [{ sku: 'SKU-1', price: 100000 }],
      });

      // id sinh sẵn trước transaction (cần cho prefix ảnh) — variant phải trỏ
      // đúng id đó.
      const productId = txProductCreate.mock.calls[0][0].data.id;
      expect(txProductCreate).toHaveBeenCalledWith({
        data: { name: 'Áo Thun', categoryId: 'cat-1', slug: 'ao-thun', id: expect.any(String) },
      });
      expect(txVariantCreate).toHaveBeenCalledWith({ data: { sku: 'SKU-1', price: 100000, productId } });
      expect(txInventoryCreate).toHaveBeenCalledWith({ data: { variantId: 'v1', quantity: 0, reservedQuantity: 0 } });
      expect(result.variants).toEqual([createdVariant]);
    });

    it('plans images (HEAD + copy) before the transaction and applies them inside it', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prismaMock.product.findUnique.mockResolvedValue(null);

      const txProductCreate = vi.fn().mockResolvedValue({ id: 'p1' });
      const tx = { product: { create: txProductCreate, findUnique: vi.fn().mockResolvedValue({ id: 'p1' }) } };
      mockTransaction(tx);
      const images = [{ key: 'tmp/product-image/k1.jpg', altText: 'Front' }, { key: 'tmp/product-image/k2.jpg' }];

      await service.create({ name: 'Áo Thun', categoryId: 'cat-1', images });

      const productId = txProductCreate.mock.calls[0][0].data.id;
      expect(productImagesServiceMock.plan).toHaveBeenCalledWith(productId, [], images);
      expect(productImagesServiceMock.apply).toHaveBeenCalledWith(tx, productId, imagePlan);
      expect(productImagesServiceMock.commit).toHaveBeenCalledWith(imagePlan, expect.any(Function));
    });

    it('does not touch storage when a cheap pre-check fails', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ name: 'Áo', categoryId: 'missing', images: [{ key: 'tmp/product-image/k1.jpg' }] }),
      ).rejects.toThrow(NotFoundException);
      expect(productImagesServiceMock.plan).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('embeds variants (including discontinued) and ordered images in the response', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1', variants: [{ id: 'v1', status: 'DISCONTINUED' }] });

      await service.findOne('p1');

      expect(prismaMock.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'p1' },
        include: {
          variants: true,
          images: expect.objectContaining({ orderBy: expect.arrayContaining([{ sortOrder: 'asc' }]) }),
        },
      });
    });
  });

  describe('update', () => {
    const current = { id: 'p1', name: 'Áo cũ', slug: 'ao-cu', categoryId: 'cat-1', variants: [], images: [] };

    it('regenerates the slug when name changes, excluding the record being updated from the duplicate check', async () => {
      prismaMock.product.findUnique
        .mockResolvedValueOnce(current) // pre-fetch trong update()
        .mockResolvedValueOnce({ id: 'p1', slug: 'ao-moi' }) // check trùng slug mới — trùng chính nó, phải bỏ qua
        .mockResolvedValueOnce({ ...current, name: 'Áo mới', slug: 'ao-moi' }); // re-fetch trả response
      const txProductUpdate = vi.fn();
      mockTransaction({ product: { update: txProductUpdate } });

      const result = await service.update('p1', { name: 'Áo mới' });

      expect(txProductUpdate).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { name: 'Áo mới', slug: 'ao-moi' } });
      expect(result.slug).toBe('ao-moi');
    });

    it('throws BadRequestException when the new name produces an empty slug', async () => {
      prismaMock.product.findUnique.mockResolvedValueOnce(current);

      await expect(service.update('p1', { name: '!!!' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('leaves variants and images untouched when those fields are omitted', async () => {
      prismaMock.product.findUnique
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(current);
      const tx = { product: { update: vi.fn() }, productVariant: { update: vi.fn(), create: vi.fn() } };
      mockTransaction(tx);

      await service.update('p1', { name: 'Áo mới' });

      expect(tx.productVariant.update).not.toHaveBeenCalled();
      expect(productImagesServiceMock.plan).not.toHaveBeenCalled();
    });

    it('returns the current product without opening a transaction for an empty payload', async () => {
      prismaMock.product.findUnique.mockResolvedValueOnce(current);

      await expect(service.update('p1', {})).resolves.toBe(current);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('reconciles a full variants array: updates known ids, creates new entries, discontinues missing ones', async () => {
      prismaMock.product.findUnique
        .mockResolvedValueOnce({
          ...current,
          variants: [
            { id: 'v-keep', productId: 'p1', sku: 'SKU-KEEP' },
            { id: 'v-retire', productId: 'p1', sku: 'SKU-RETIRE' },
          ],
        })
        .mockResolvedValueOnce(current);
      const txVariantUpdate = vi.fn();
      const txVariantCreate = vi.fn().mockResolvedValue({ id: 'v-new' });
      const txInventoryCreate = vi.fn();
      mockTransaction({
        productVariant: { update: txVariantUpdate, create: txVariantCreate },
        inventory: { create: txInventoryCreate },
      });

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
      prismaMock.product.findUnique.mockResolvedValueOnce(current);

      await expect(service.update('p1', { variants: [{ id: 'foreign-variant', sku: 'X', price: 1 }] })).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('applies product fields, variants and images inside one single transaction', async () => {
      prismaMock.product.findUnique
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(current);
      const tx = {
        product: { update: vi.fn() },
        productVariant: { update: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'v-new' }) },
        inventory: { create: vi.fn() },
      };
      mockTransaction(tx);
      const images = [{ key: 'tmp/product-image/k1.jpg' }];

      await service.update('p1', { name: 'Áo mới', variants: [{ sku: 'SKU-NEW', price: 1 }], images });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.product.update).toHaveBeenCalled();
      expect(tx.productVariant.create).toHaveBeenCalled();
      expect(productImagesServiceMock.plan).toHaveBeenCalledWith('p1', [], images);
      expect(productImagesServiceMock.apply).toHaveBeenCalledWith(tx, 'p1', imagePlan);
    });

    it('throws a friendly ConflictException (not a raw Prisma error) when a new variant entry races another request on sku', async () => {
      prismaMock.product.findUnique.mockResolvedValueOnce(current);
      const txVariantCreate = vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['sku'] },
        }),
      );
      mockTransaction({ productVariant: { create: txVariantCreate, update: vi.fn() }, inventory: { create: vi.fn() } });

      await expect(service.update('p1', { variants: [{ sku: 'SKU-RACE', price: 100000 }] })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the product, then discards its image objects', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1', images: [{ url: 'https://x/products/p1/a.jpg' }] });

      await service.remove('p1');

      expect(prismaMock.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(productImagesServiceMock.discardUrls).toHaveBeenCalledWith(['https://x/products/p1/a.jpg']);
    });
  });
});
