import {
  ObjectStorageService,
  PresignFileRequest,
  PresignedUploadTarget,
} from '@src/upload-image/object-storage/object-storage.service.js';
import { MAX_IMAGE_SIZE_BYTES } from '@src/upload-image/upload-image.constants.js';
import { pendingObjectKey } from '@src/upload-image/object-storage/pending-object-key.js';

const FAKE_BASE_URL = 'https://fake-storage.local/';

// Fake in-memory (chỉ dùng cho test, không build vào dist) — override provider trong create-test-app.ts để
// e2e không cần MinIO thật chạy. Không thực sự upload/xoá gì, chỉ ghi nhớ key
// nào đang "tồn tại" (sau simulateUpload()/copy()) và key nào đã bị "delete"
// để test có thể assert.
export class FakeObjectStorageService implements ObjectStorageService {
  readonly objects = new Set<string>();
  readonly deletedKeys: string[] = [];
  // Bật để mô phỏng storage không phản hồi — exists()/copy() throw như SDK
  // thật khi mạng lỗi, test dùng để chứng minh API trả 503 thay vì 400.
  unavailable = false;

  // Cùng format key (`<prefix><uuid>.<ext>`) và tên field (`Content-Type`)
  // với S3ObjectStorageService, để e2e bắt được lỗi phụ thuộc format key.
  async presignBatch(keyPrefix: string, files: PresignFileRequest[]): Promise<PresignedUploadTarget[]> {
    return files.map(({ contentType }) => {
      const key = pendingObjectKey(keyPrefix, contentType);
      return { key, uploadUrl: FAKE_BASE_URL, fields: { key, 'Content-Type': contentType } };
    });
  }

  // Không phải một phần của ObjectStorageService interface — chỉ tồn tại ở
  // fake để test có thể chứng minh policy (content-length-range,
  // Content-Type) thực sự chặn được file sai, mà không cần chạy MinIO thật.
  // Mô phỏng đúng 2 điều kiện đã nhúng trong S3ObjectStorageService.presignBatch().
  // Upload hợp lệ thì object "tồn tại" từ đó — exists() trả true.
  simulateUpload(target: PresignedUploadTarget, file: { sizeBytes: number; contentType: string }): void {
    if (file.sizeBytes < 1 || file.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Upload rejected by content-length-range policy: must be 1-${MAX_IMAGE_SIZE_BYTES} bytes`);
    }
    const expectedContentType = target.fields['Content-Type'];
    if (file.contentType !== expectedContentType) {
      throw new Error(
        `Upload rejected by content-type policy: expected "${expectedContentType}", got "${file.contentType}"`,
      );
    }
    this.objects.add(target.key);
  }

  async exists(key: string): Promise<boolean> {
    this.assertAvailable();
    return this.objects.has(key);
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    this.assertAvailable();
    if (!this.objects.has(sourceKey)) {
      throw new Error(`NoSuchKey: ${sourceKey}`);
    }
    this.objects.add(destinationKey);
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
    this.deletedKeys.push(key);
  }

  publicUrl(key: string): string {
    return `${FAKE_BASE_URL}${key}`;
  }

  keyFromUrl(url: string): string {
    if (!url.startsWith(FAKE_BASE_URL)) {
      throw new Error(`URL "${url}" is not a fake storage object URL`);
    }
    return url.slice(FAKE_BASE_URL.length);
  }

  private assertAvailable(): void {
    if (this.unavailable) {
      throw new Error('Fake storage is unavailable');
    }
  }
}
