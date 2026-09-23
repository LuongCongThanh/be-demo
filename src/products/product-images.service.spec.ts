import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductImagesService } from './product-images.service.js';
import { UploadImageService } from '../upload-image/upload-image.service.js';
import { FakeObjectStorageService } from '../upload-image/object-storage/fake-object-storage.service.js';
import type { Prisma } from '../generated/prisma/client.js';

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
      storage.objects.add('tmp/product-image/new.jpg');

      const plan = await service.plan('p1', EXISTING, [
        { key: 'tmp/product-image/new.jpg', altText: 'New cover' },
        { id: 'img-b' },
      ]);

      expect(plan.rows).toEqual([
        { url: 'https://fake-storage.local/products/p1/new.jpg', altText: 'New cover' },
        { id: 'img-b', altText: undefined },
      ]);
      expect(plan.removedIds).toEqual(['img-a']);
      expect(plan.removedUrls).toEqual(['https://fake-storage.local/products/p1/a.jpg']);
      expect(plan.pendingKeys).toEqual(['tmp/product-image/new.jpg']);
    });

    it.each([[{ altText: 'neither' }], [{ id: 'img-a', key: 'tmp/product-image/x.jpg' }]])(
      'rejects an entry without exactly one of id/key: %o',
      async (entry) => {
        await expect(service.plan('p1', EXISTING, [entry])).rejects.toThrow(BadRequestException);
      },
    );

    it('rejects duplicate ids or keys', async () => {
      await expect(service.plan('p1', EXISTING, [{ id: 'img-a' }, { id: 'img-a' }])).rejects.toThrow(
        'Duplicate image entries are not allowed',
      );
    });

    it('rejects an id that belongs to another product', async () => {
      await expect(service.plan('p1', EXISTING, [{ id: 'img-of-other-product' }])).rejects.toThrow(BadRequestException);
    });

    it('undoes already-promoted copies when one copy fails', async () => {
      storage.objects.add('tmp/product-image/ok.jpg');
      storage.objects.add('tmp/product-image/bad.jpg');
      const realCopy = storage.copy.bind(storage);
      storage.copy = async (source, destination) => {
        if (source.endsWith('bad.jpg')) throw new Error('copy failed');
        return realCopy(source, destination);
      };

      await expect(
        service.plan('p1', [], [{ key: 'tmp/product-image/ok.jpg' }, { key: 'tmp/product-image/bad.jpg' }]),
      ).rejects.toThrow();
      expect(storage.objects.has('products/p1/ok.jpg')).toBe(false);
    });
  });

  describe('apply', () => {
    it('deletes removed rows, then writes sortOrder = array index for kept and new rows', async () => {
      const tx = {
        productImage: { deleteMany: vi.fn(), update: vi.fn(), create: vi.fn() },
      } as unknown as Prisma.TransactionClient;

      await service.apply(tx, 'p1', {
        rows: [{ url: 'https://fake-storage.local/products/p1/new.jpg' }, { id: 'img-b', altText: 'Back' }],
        removedIds: ['img-a'],
        removedUrls: [],
        promotedUrls: [],
        pendingKeys: [],
      });

      expect(tx.productImage.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p1', id: { in: ['img-a'] } } });
      expect(tx.productImage.create).toHaveBeenCalledWith({
        data: {
          productId: 'p1',
          url: 'https://fake-storage.local/products/p1/new.jpg',
          altText: undefined,
          sortOrder: 0,
        },
      });
      expect(tx.productImage.update).toHaveBeenCalledWith({
        where: { id: 'img-b' },
        data: { sortOrder: 1, altText: 'Back' },
      });
    });
  });

  describe('commit', () => {
    const plan = {
      rows: [],
      removedIds: ['img-a'],
      removedUrls: ['https://fake-storage.local/products/p1/a.jpg'],
      promotedUrls: ['https://fake-storage.local/products/p1/new.jpg'],
      pendingKeys: ['tmp/product-image/new.jpg'],
    };

    it('after a successful write, deletes removed objects and the temp uploads, keeping promoted copies', async () => {
      await service.commit(plan, async () => 'ok');

      expect(storage.deletedKeys).toEqual(['products/p1/a.jpg', 'tmp/product-image/new.jpg']);
    });

    it('after a failed write, deletes only the promoted copies and rethrows', async () => {
      await expect(
        service.commit(plan, async () => {
          throw new Error('tx failed');
        }),
      ).rejects.toThrow('tx failed');

      expect(storage.deletedKeys).toEqual(['products/p1/new.jpg']);
    });
  });
});
