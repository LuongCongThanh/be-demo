import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductImagesService } from './product-images.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OBJECT_STORAGE_SERVICE } from './object-storage/object-storage.service.js';

describe('ProductImagesService', () => {
  let service: ProductImagesService;
  const prismaMock = {
    product: { findUnique: vi.fn() },
    productImage: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const storageMock = {
    presignBatch: vi.fn(),
    delete: vi.fn(),
    publicUrl: vi.fn((key: string) => `https://fake-storage.local/${key}`),
    keyFromUrl: vi.fn((url: string) => url.replace('https://fake-storage.local/', '')),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductImagesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: OBJECT_STORAGE_SERVICE, useValue: storageMock },
      ],
    }).compile();

    service = moduleRef.get(ProductImagesService);
    vi.clearAllMocks();
    storageMock.publicUrl.mockImplementation((key: string) => `https://fake-storage.local/${key}`);
    storageMock.keyFromUrl.mockImplementation((url: string) => url.replace('https://fake-storage.local/', ''));
  });

  describe('presign', () => {
    it('delegates to ObjectStorageService.presignBatch', async () => {
      storageMock.presignBatch.mockResolvedValue([{ key: 'k1', uploadUrl: 'u1', fields: {} }]);

      const result = await service.presign({ files: [{ filename: 'a.jpg', contentType: 'image/jpeg' }] });

      expect(storageMock.presignBatch).toHaveBeenCalledWith([{ filename: 'a.jpg', contentType: 'image/jpeg' }]);
      expect(result).toEqual([{ key: 'k1', uploadUrl: 'u1', fields: {} }]);
    });
  });

  describe('attachImage', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(service.attachImage('missing-product', { key: 'k1' })).rejects.toThrow(NotFoundException);
    });

    it('makes the image primary automatically when it is the first image for the product', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' });
      prismaMock.productImage.count.mockResolvedValue(0);
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
      const txCreate = vi.fn().mockResolvedValue({ id: 'img1', isPrimary: true });
      prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({ productImage: { updateMany: txUpdateMany, create: txCreate } }),
      );

      await service.attachImage('p1', { key: 'k1', altText: 'Front' });

      expect(txCreate).toHaveBeenCalledWith({
        data: { productId: 'p1', url: 'https://fake-storage.local/k1', altText: 'Front', isPrimary: true },
      });
    });

    it('defaults isPrimary to false when the product already has images and none was requested', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' });
      prismaMock.productImage.count.mockResolvedValue(2);
      prismaMock.productImage.create.mockResolvedValue({ id: 'img2', isPrimary: false });

      await service.attachImage('p1', { key: 'k2' });

      expect(prismaMock.productImage.create).toHaveBeenCalledWith({
        data: { productId: 'p1', url: 'https://fake-storage.local/k2', altText: undefined, isPrimary: false },
      });
    });

    it('unsets the previous primary before setting the new one when isPrimary is explicitly requested', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' });
      prismaMock.productImage.count.mockResolvedValue(1);
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const txCreate = vi.fn().mockResolvedValue({ id: 'img2', isPrimary: true });
      prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({ productImage: { updateMany: txUpdateMany, create: txCreate } }),
      );

      await service.attachImage('p1', { key: 'k2', isPrimary: true });

      expect(txUpdateMany).toHaveBeenCalledWith({
        where: { productId: 'p1', isPrimary: true },
        data: { isPrimary: false },
      });
      expect(txCreate).toHaveBeenCalledWith({
        data: { productId: 'p1', url: 'https://fake-storage.local/k2', altText: undefined, isPrimary: true },
      });
    });
  });

  describe('listImages', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(service.listImages('missing-product')).rejects.toThrow(NotFoundException);
    });

    it('returns the images for the product, unpaginated', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' });
      prismaMock.productImage.findMany.mockResolvedValue([{ id: 'img1' }, { id: 'img2' }]);

      const result = await service.listImages('p1');

      expect(prismaMock.productImage.findMany).toHaveBeenCalledWith({ where: { productId: 'p1' } });
      expect(result).toEqual([{ id: 'img1' }, { id: 'img2' }]);
    });
  });

  describe('setPrimary', () => {
    it('throws NotFoundException when the image does not belong to this product', async () => {
      prismaMock.productImage.findFirst.mockResolvedValue(null);

      await expect(service.setPrimary('p1', 'img1')).rejects.toThrow(NotFoundException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('unsets the old primary and sets the target image in one transaction', async () => {
      prismaMock.productImage.findFirst.mockResolvedValue({ id: 'img2', productId: 'p1' });
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const txUpdate = vi.fn().mockResolvedValue({ id: 'img2', isPrimary: true });
      prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({ productImage: { updateMany: txUpdateMany, update: txUpdate } }),
      );

      await service.setPrimary('p1', 'img2');

      expect(txUpdateMany).toHaveBeenCalledWith({
        where: { productId: 'p1', isPrimary: true },
        data: { isPrimary: false },
      });
      expect(txUpdate).toHaveBeenCalledWith({ where: { id: 'img2' }, data: { isPrimary: true } });
    });
  });

  describe('removeImage', () => {
    it('throws NotFoundException when the image does not belong to this product', async () => {
      prismaMock.productImage.findFirst.mockResolvedValue(null);

      await expect(service.removeImage('p1', 'img1')).rejects.toThrow(NotFoundException);
      expect(prismaMock.productImage.delete).not.toHaveBeenCalled();
    });

    it('deletes the DB row before calling storage delete, and does not throw if storage delete fails', async () => {
      prismaMock.productImage.findFirst.mockResolvedValue({
        id: 'img1',
        productId: 'p1',
        url: 'https://fake-storage.local/k1',
      });
      prismaMock.productImage.delete.mockResolvedValue({});
      storageMock.delete.mockRejectedValue(new Error('storage down'));

      await expect(service.removeImage('p1', 'img1')).resolves.toBeUndefined();

      expect(prismaMock.productImage.delete).toHaveBeenCalledWith({ where: { id: 'img1' } });
      expect(storageMock.delete).toHaveBeenCalledWith('k1');
    });
  });

  describe('rejects invalid batch primary selection (used by ProductsService.create)', () => {
    it('throws BadRequestException when resolvePrimary sees 2+ entries marked primary', () => {
      expect(() =>
        service.resolveBatchPrimary([
          { key: 'a', isPrimary: true },
          { key: 'b', isPrimary: true },
        ]),
      ).toThrow(BadRequestException);
    });

    it('defaults the first entry to primary when none is marked', () => {
      const resolved = service.resolveBatchPrimary([{ key: 'a' }, { key: 'b' }]);
      expect(resolved.map((e) => e.isPrimary)).toEqual([true, false]);
    });

    it('keeps the explicitly marked entry as primary', () => {
      const resolved = service.resolveBatchPrimary([{ key: 'a' }, { key: 'b', isPrimary: true }]);
      expect(resolved.map((e) => e.isPrimary)).toEqual([false, true]);
    });
  });
});
