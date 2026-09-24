import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductImagesService } from '@src/products/product-images.service.js';
import { UploadImageService } from '@src/upload-image/upload-image.service.js';
import { FakeObjectStorageService } from '@src/upload-image/object-storage/fake-object-storage.service.js';
import type { Prisma } from '@src/generated/prisma/client.js';

const EXISTING = [
  { id: 'img-a', url: 'https://fake-storage.local/products/p1/a.jpg' },
  { id: 'img-b', url: 'https://fake-storage.local/products/p1/b.jpg' },
];

describe('ProductImagesService', () => {
  let storage: FakeObjectStorageService;
  let service: ProductImagesService;

  beforeEach(() => {
    storage = new FakeObjectStorageService();
    service = new ProductImagesService(new UploadImageService(storage));
  });

  describe('plan', () => {
    it('keeps array order, promotes new keys under products/<id>/ and marks absent images as removed', async () => {
      storage.objects.add('tmp/product-image/00000000-0000-4000-8000-000000000001.jpg');

      const plan = await service.plan('p1', EXISTING, [
        { key: 'tmp/product-image/00000000-0000-4000-8000-000000000001.jpg', altText: 'New cover' },
        { id: 'img-b' },
      ]);

      expect(plan.rows).toEqual([
        {
          url: 'https://fake-storage.local/products/p1/00000000-0000-4000-8000-000000000001.jpg',
          altText: 'New cover',
        },
        { id: 'img-b', altText: undefined },
      ]);
      expect(plan.removedIds).toEqual(['img-a']);
      expect(plan.removedUrls).toEqual(['https://fake-storage.local/products/p1/a.jpg']);
      expect(plan.pendingKeys).toEqual(['tmp/product-image/00000000-0000-4000-8000-000000000001.jpg']);
    });

    it.each([
      [{ altText: 'neither' }],
      [{ id: 'img-a', key: 'tmp/product-image/00000000-0000-4000-8000-000000000002.jpg' }],
    ])('rejects an entry without exactly one of id/key: %o', async (entry) => {
      await expect(service.plan('p1', EXISTING, [entry])).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate ids or keys', async () => {
      await expect(service.plan('p1', EXISTING, [{ id: 'img-a' }, { id: 'img-a' }])).rejects.toThrow(
        'Duplicate image entries are not allowed',
      );
    });

    it('rejects an id that belongs to another product', async () => {
      await expect(service.plan('p1', EXISTING, [{ id: 'img-of-other-product' }])).rejects.toThrow(BadRequestException);
    });

    it('undoes already-promoted copies when one copy fails', async () => {
      storage.objects.add('tmp/product-image/00000000-0000-4000-8000-000000000003.jpg');
      storage.objects.add('tmp/product-image/00000000-0000-4000-8000-000000000004.jpg');
      const realCopy = storage.copy.bind(storage);
      storage.copy = async (source, destination) => {
        if (source.endsWith('000000000004.jpg')) throw new Error('copy failed');
        return realCopy(source, destination);
      };

      await expect(
        service.plan(
          'p1',
          [],
          [
            { key: 'tmp/product-image/00000000-0000-4000-8000-000000000003.jpg' },
            { key: 'tmp/product-image/00000000-0000-4000-8000-000000000004.jpg' },
          ],
        ),
      ).rejects.toThrow();
      expect(storage.objects.has('products/p1/00000000-0000-4000-8000-000000000003.jpg')).toBe(false);
    });
  });

  describe('apply', () => {
    it('deletes removed rows, then writes sortOrder = array index for kept and new rows', async () => {
      const tx = {
        productImage: { deleteMany: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn() },
      } as unknown as Prisma.TransactionClient;

      await service.apply(tx, 'p1', {
        rows: [
          { url: 'https://fake-storage.local/products/p1/00000000-0000-4000-8000-000000000001.jpg' },
          { id: 'img-b', altText: 'Back' },
        ],
        removedIds: ['img-a'],
        removedUrls: [],
        promotedUrls: [],
        pendingKeys: [],
      });

      expect(tx.productImage.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p1', id: { in: ['img-a'] } } });
      expect(tx.productImage.create).toHaveBeenCalledWith({
        data: {
          productId: 'p1',
          url: 'https://fake-storage.local/products/p1/00000000-0000-4000-8000-000000000001.jpg',
          altText: undefined,
          sortOrder: 0,
        },
      });
      expect(tx.productImage.updateMany).toHaveBeenCalledWith({
        where: { id: 'img-b', productId: 'p1' },
        data: { sortOrder: 1, altText: 'Back' },
      });
    });

    it('rejects with 409 when a kept image was removed concurrently after plan()', async () => {
      const tx = {
        productImage: { deleteMany: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn() },
      } as unknown as Prisma.TransactionClient;

      await expect(
        service.apply(tx, 'p1', {
          rows: [{ id: 'img-b' }],
          removedIds: [],
          removedUrls: [],
          promotedUrls: [],
          pendingKeys: [],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('commit', () => {
    const plan = {
      rows: [],
      removedIds: ['img-a'],
      removedUrls: ['https://fake-storage.local/products/p1/a.jpg'],
      promotedUrls: ['https://fake-storage.local/products/p1/00000000-0000-4000-8000-000000000001.jpg'],
      pendingKeys: ['tmp/product-image/00000000-0000-4000-8000-000000000001.jpg'],
    };

    it('after a successful write, deletes removed objects and the temp uploads, keeping promoted copies', async () => {
      await service.commit(plan, async () => 'ok');

      expect(storage.deletedKeys).toEqual([
        'products/p1/a.jpg',
        'tmp/product-image/00000000-0000-4000-8000-000000000001.jpg',
      ]);
    });

    it('after a failed write, deletes only the promoted copies and rethrows', async () => {
      await expect(
        service.commit(plan, async () => {
          throw new Error('tx failed');
        }),
      ).rejects.toThrow('tx failed');

      expect(storage.deletedKeys).toEqual(['products/p1/00000000-0000-4000-8000-000000000001.jpg']);
    });
  });
});
