import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { UploadImageService } from '@src/modules/upload-image/upload-image.service.js';
import { FakeObjectStorageService } from '../../../test/support/fake-object-storage.service.js';
import type { JwtPayload } from '@src/auth/strategies/jwt.strategy.js';

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
      storage.objects.add('tmp/product-image/00000000-0000-4000-8000-000000000001.jpg');

      await expect(
        service.assertPendingUploads('PRODUCT_IMAGE', ['tmp/product-image/00000000-0000-4000-8000-000000000001.jpg']),
      ).resolves.toBeUndefined();
    });

    it('rejects keys outside the purpose prefix with 400 without calling storage', async () => {
      storage.unavailable = true; // chứng minh không gọi storage: nếu gọi sẽ ra 503

      await expect(service.assertPendingUploads('PRODUCT_IMAGE', ['products/p1/a.jpg'])).rejects.toThrow(
        BadRequestException,
      );
    });

    // Chỉ đúng tên presign sinh ra: `<uuid>.<ext>` — tên tự đặt (`new.jpg`) cũng bị chặn.
    it.each([
      'tmp/product-image/abc./a/cover',
      'tmp/product-image/../products/p2/a.jpg',
      'tmp/product-image/a.gif',
      'tmp/product-image/new.jpg',
    ])(
      'rejects a key whose name after the prefix is not a presign-generated object name (%s) with 400',
      async (key) => {
        storage.objects.add(key);
        storage.unavailable = true; // chứng minh không gọi storage: nếu gọi sẽ ra 503

        await expect(service.assertPendingUploads('PRODUCT_IMAGE', [key])).rejects.toThrow(BadRequestException);
      },
    );

    it('rejects with 400 listing every key whose object was never uploaded', async () => {
      storage.objects.add('tmp/product-image/00000000-0000-4000-8000-000000000002.jpg');

      await expect(
        service.assertPendingUploads('PRODUCT_IMAGE', [
          'tmp/product-image/00000000-0000-4000-8000-000000000002.jpg',
          'tmp/product-image/00000000-0000-4000-8000-000000000003.jpg',
          'tmp/product-image/00000000-0000-4000-8000-000000000004.jpg',
        ]),
      ).rejects.toThrow(
        'Uploaded image not found: tmp/product-image/00000000-0000-4000-8000-000000000003.jpg, tmp/product-image/00000000-0000-4000-8000-000000000004.jpg',
      );
    });

    it('maps a storage outage to 503, not 400', async () => {
      storage.unavailable = true;

      await expect(
        service.assertPendingUploads('PRODUCT_IMAGE', ['tmp/product-image/00000000-0000-4000-8000-000000000001.jpg']),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('promote', () => {
    it('copies the pending object under the destination prefix, keeping the file name, and leaves the temp copy', async () => {
      storage.objects.add('tmp/product-image/00000000-0000-4000-8000-000000000005.jpg');

      const url = await service.promote('tmp/product-image/00000000-0000-4000-8000-000000000005.jpg', 'products/p1/');

      expect(url).toBe('https://fake-storage.local/products/p1/00000000-0000-4000-8000-000000000005.jpg');
      expect(storage.objects.has('products/p1/00000000-0000-4000-8000-000000000005.jpg')).toBe(true);
      expect(storage.objects.has('tmp/product-image/00000000-0000-4000-8000-000000000005.jpg')).toBe(true);
    });

    // Pending Upload hết hạn (lifecycle 1 ngày) hoặc bị dọn giữa lúc HEAD và
    // copy — lỗi của client (gửi lại ảnh), không phải storage sập.
    it('maps a copy failure to 400 when the pending object no longer exists', async () => {
      const key = 'tmp/product-image/00000000-0000-4000-8000-000000000006.jpg';
      storage.copy = async () => {
        throw new Error('NoSuchKey');
      };

      await expect(service.promote(key, 'products/p1/')).rejects.toThrow(`Uploaded image not found: ${key}`);
    });

    it('keeps 503 for a copy failure while the pending object still exists', async () => {
      const key = 'tmp/product-image/00000000-0000-4000-8000-000000000007.jpg';
      storage.objects.add(key);
      storage.copy = async () => {
        throw new Error('network down');
      };

      await expect(service.promote(key, 'products/p1/')).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('discardKeys', () => {
    it('swallows storage delete failures (best-effort)', async () => {
      storage.delete = async () => {
        throw new Error('boom');
      };

      await expect(
        service.discardKeys(['tmp/product-image/00000000-0000-4000-8000-000000000001.jpg']),
      ).resolves.toBeUndefined();
    });
  });

  describe('discardUrls', () => {
    it('still deletes the other objects when one URL cannot be mapped to a key', async () => {
      await expect(
        service.discardUrls(['https://unknown-host/x.jpg', 'https://fake-storage.local/products/p1/a.jpg']),
      ).resolves.toBeUndefined();

      expect(storage.deletedKeys).toEqual(['products/p1/a.jpg']);
    });
  });
});
