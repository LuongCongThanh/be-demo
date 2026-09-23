import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { UploadImageService } from './upload-image.service.js';
import { FakeObjectStorageService } from './object-storage/fake-object-storage.service.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

function userWith(roles: string[]): JwtPayload {
  return { sub: 'u1', email: 'u1@example.com', roles, authorizationVersion: 1 };
}

describe('UploadImageService', () => {
  let storage: FakeObjectStorageService;
  let service: UploadImageService;

  beforeEach(() => {
    storage = new FakeObjectStorageService();
    service = new UploadImageService(storage);
  });

  describe('presign', () => {
    it('puts PRODUCT_IMAGE keys under tmp/product-image/', async () => {
      const targets = await service.presign(userWith(['STORE_MANAGER']), {
        purpose: 'PRODUCT_IMAGE',
        files: [{ filename: 'a.jpg', contentType: 'image/jpeg' }],
      });

      expect(targets[0].key.startsWith('tmp/product-image/')).toBe(true);
    });

    it('rejects a role not allowed for the purpose with 403', async () => {
      await expect(
        service.presign(userWith(['CUSTOMER']), {
          purpose: 'PRODUCT_IMAGE',
          files: [{ filename: 'a.jpg', contentType: 'image/jpeg' }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assertPendingUploads', () => {
    it('passes when every key has the purpose prefix and exists', async () => {
      storage.objects.add('tmp/product-image/a.jpg');

      await expect(service.assertPendingUploads('PRODUCT_IMAGE', ['tmp/product-image/a.jpg'])).resolves.toBeUndefined();
    });

    it('rejects keys outside the purpose prefix with 400 without calling storage', async () => {
      storage.unavailable = true; // chứng minh không gọi storage: nếu gọi sẽ ra 503

      await expect(service.assertPendingUploads('PRODUCT_IMAGE', ['products/p1/a.jpg'])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects with 400 listing every key whose object was never uploaded', async () => {
      storage.objects.add('tmp/product-image/ok.jpg');

      await expect(
        service.assertPendingUploads('PRODUCT_IMAGE', [
          'tmp/product-image/ok.jpg',
          'tmp/product-image/missing-1.jpg',
          'tmp/product-image/missing-2.jpg',
        ]),
      ).rejects.toThrow('Uploaded image not found: tmp/product-image/missing-1.jpg, tmp/product-image/missing-2.jpg');
    });

    it('maps a storage outage to 503, not 400', async () => {
      storage.unavailable = true;

      await expect(service.assertPendingUploads('PRODUCT_IMAGE', ['tmp/product-image/a.jpg'])).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('promote', () => {
    it('copies the pending object under the destination prefix, keeping the file name, and leaves the temp copy', async () => {
      storage.objects.add('tmp/product-image/abc.jpg');

      const url = await service.promote('tmp/product-image/abc.jpg', 'products/p1/');

      expect(url).toBe('https://fake-storage.local/products/p1/abc.jpg');
      expect(storage.objects.has('products/p1/abc.jpg')).toBe(true);
      expect(storage.objects.has('tmp/product-image/abc.jpg')).toBe(true);
    });
  });

  describe('discardKeys', () => {
    it('swallows storage delete failures (best-effort)', async () => {
      storage.delete = async () => {
        throw new Error('boom');
      };

      await expect(service.discardKeys(['tmp/product-image/a.jpg'])).resolves.toBeUndefined();
    });
  });
});
