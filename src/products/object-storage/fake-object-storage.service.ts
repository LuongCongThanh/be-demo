import { randomUUID } from 'node:crypto';
import { ObjectStorageService, PresignedUploadTarget } from './object-storage.service.js';
import { MAX_IMAGE_SIZE_BYTES } from './allowed-image-content-type.js';

// Fake in-memory — override provider trong test/support/create-test-app.ts để
// e2e không cần MinIO thật chạy. Không thực sự upload/xoá gì, chỉ sinh key
// giả và ghi nhớ key nào đã "delete" để test có thể assert.
export class FakeObjectStorageService implements ObjectStorageService {
  readonly deletedKeys: string[] = [];

  async presignBatch(files: { filename: string; contentType: string }[]): Promise<PresignedUploadTarget[]> {
    return files.map(({ filename, contentType }) => {
      const key = `products/uploads/${randomUUID()}-${filename}`;
      return { key, uploadUrl: `https://fake-storage.local/${key}`, fields: { key, contentType } };
    });
  }

  // Không phải một phần của ObjectStorageService interface — chỉ tồn tại ở
  // fake để test có thể chứng minh policy (content-length-range,
  // Content-Type) thực sự chặn được file sai, mà không cần chạy MinIO thật.
  // Mô phỏng đúng 2 điều kiện đã nhúng trong S3ObjectStorageService.presignBatch().
  simulateUpload(target: PresignedUploadTarget, file: { sizeBytes: number; contentType: string }): void {
    if (file.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Upload rejected by content-length-range policy: exceeds ${MAX_IMAGE_SIZE_BYTES} bytes`);
    }
    if (file.contentType !== target.fields.contentType) {
      throw new Error(
        `Upload rejected by content-type policy: expected "${target.fields.contentType}", got "${file.contentType}"`,
      );
    }
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
