import { randomUUID } from 'node:crypto';
import { ObjectStorageService, PresignedUploadTarget } from './object-storage.service.js';

// Fake in-memory — override provider trong test/support/create-test-app.ts để
// e2e không cần MinIO thật chạy. Không thực sự upload/xoá gì, chỉ sinh key
// giả và ghi nhớ key nào đã "delete" để test có thể assert.
export class FakeObjectStorageService implements ObjectStorageService {
  readonly deletedKeys: string[] = [];

  async presignBatch(files: { filename: string; contentType: string }[]): Promise<PresignedUploadTarget[]> {
    return files.map(({ filename }) => {
      const key = `products/uploads/${randomUUID()}-${filename}`;
      return { key, uploadUrl: `https://fake-storage.local/${key}`, fields: { key } };
    });
  }

  async delete(key: string): Promise<void> {
    this.deletedKeys.push(key);
  }

  publicUrl(key: string): string {
    return `https://fake-storage.local/${key}`;
  }

  keyFromUrl(url: string): string {
    return url.replace('https://fake-storage.local/', '');
  }
}
