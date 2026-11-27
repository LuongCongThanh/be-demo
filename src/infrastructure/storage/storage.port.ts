/** Bộ tham số để trình duyệt gửi form POST thẳng lên kho ảnh (cùng dạng presigned POST của S3). */
export interface SignedUpload {
  uploadUrl: string;
  fields: Record<string, string>;
  expiresAt: Date;
}

export interface StoredImage {
  bytes: number;
  /** Định dạng nhận diện từ nội dung file: `jpg`, `png`, `webp`, ... */
  format: string;
}

/** Port kho ảnh dùng chung (product và Category); chỉ khai báo method đang được gọi. */
export abstract class ImageStorage {
  abstract publicUrl(storageKey: string): string | null;
  abstract signUpload(storageKey: string, allowedFormats: readonly string[]): SignedUpload;
  /** null khi chưa có file với key này. */
  abstract findImage(storageKey: string): Promise<StoredImage | null>;
  abstract destroy(storageKey: string): Promise<void>;
}
