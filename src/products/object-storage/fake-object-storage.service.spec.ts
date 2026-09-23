import { describe, expect, it } from 'vitest';
import { FakeObjectStorageService } from './fake-object-storage.service.js';
import { MAX_IMAGE_SIZE_BYTES } from './allowed-image-content-type.js';

// Đây là gap được flag ở code review PR #28: unit test trước đó chỉ kiểm tra
// nội dung policy document (S3ObjectStorageService.spec.ts) chứ chưa từng
// thực sự "upload" và assert bị chối — cả tiêu chí AC "reject oversized/wrong
// mime" của issue #26 lẫn phần "ideally once against real MinIO" chưa được
// verify. simulateUpload() ở đây mô phỏng đúng 2 điều kiện policy thật
// (content-length-range, Content-Type khớp) mà không cần MinIO chạy.
describe('FakeObjectStorageService', () => {
  const service = new FakeObjectStorageService();

  it('accepts an upload within the size limit and matching content type', async () => {
    const [target] = await service.presignBatch([{ filename: 'a.jpg', contentType: 'image/jpeg' }]);

    expect(() => service.simulateUpload(target, { sizeBytes: 1024, contentType: 'image/jpeg' })).not.toThrow();
  });

  it('rejects an upload that exceeds MAX_IMAGE_SIZE_BYTES (content-length-range)', async () => {
    const [target] = await service.presignBatch([{ filename: 'a.jpg', contentType: 'image/jpeg' }]);

    expect(() =>
      service.simulateUpload(target, { sizeBytes: MAX_IMAGE_SIZE_BYTES + 1, contentType: 'image/jpeg' }),
    ).toThrow(/content-length-range/);
  });

  it('rejects an upload whose content type does not match the presigned target (Content-Type condition)', async () => {
    const [target] = await service.presignBatch([{ filename: 'a.jpg', contentType: 'image/jpeg' }]);

    expect(() => service.simulateUpload(target, { sizeBytes: 1024, contentType: 'image/gif' })).toThrow(
      /content-type/i,
    );
  });
});
