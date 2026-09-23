export interface PresignedUploadTarget {
  key: string;
  uploadUrl: string;
  fields: Record<string, string>;
}

export const OBJECT_STORAGE_SERVICE = Symbol('OBJECT_STORAGE_SERVICE');

// Token DI riêng (không phải class injection thẳng) để e2e test override
// bằng fake in-memory (xem test/support/create-test-app.ts) — cùng pattern
// override provider đã dùng cho ThrottlerGuard/EmailThrottlerGuard.
export interface ObjectStorageService {
  // Sinh key mới dưới `keyPrefix` cho từng file — caller (UploadImageService)
  // quyết định prefix theo purpose, adapter không biết gì về nghiệp vụ.
  presignBatch(keyPrefix: string, files: { filename: string; contentType: string }[]): Promise<PresignedUploadTarget[]>;
  // HEAD object: `false` khi object không tồn tại; lỗi khác (mạng, quyền,
  // storage sập) phải throw để caller phân biệt 400 với 503.
  exists(key: string): Promise<boolean>;
  // Copy server-side trong cùng bucket — dùng để chuyển Pending Upload từ
  // `tmp/` sang prefix chính khi gắn vào Product (docs/adr/0010).
  copy(sourceKey: string, destinationKey: string): Promise<void>;
  delete(key: string): Promise<void>;
  // URL công khai để trả về client / lưu vào ProductImage.url.
  publicUrl(key: string): string;
  // Ngược lại publicUrl() — DB (`ProductImage.url`) chỉ lưu URL công khai,
  // không lưu key riêng, nên xoá ảnh (delete(key)) cần suy ngược key từ url.
  keyFromUrl(url: string): string;
}
