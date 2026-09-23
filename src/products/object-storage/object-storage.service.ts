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
  presignBatch(files: { filename: string; contentType: string }[]): Promise<PresignedUploadTarget[]>;
  delete(key: string): Promise<void>;
  // URL công khai để trả về client / lưu vào ProductImage.url — tách riêng
  // khỏi presignBatch() vì cần dùng lại khi attach ảnh đã upload trước đó
  // (key đã biết, không cần xin presign lại).
  publicUrl(key: string): string;
  // Ngược lại publicUrl() — DB (`ProductImage.url`) chỉ lưu URL công khai,
  // không lưu key riêng, nên xoá ảnh (delete(key)) cần suy ngược key từ url.
  keyFromUrl(url: string): string;
}
