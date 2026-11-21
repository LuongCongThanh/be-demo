export const CATEGORY_IMAGE_STORAGE = Symbol('CATEGORY_IMAGE_STORAGE');

export interface SignedCategoryImageUpload {
  uploadUrl: string;
  fields: Record<string, string>;
  expiresAt: Date;
}

export interface StoredCategoryImage {
  bytes: number;
  format: string;
}

export interface CategoryImageStorage {
  publicUrl(storageKey: string): string | null;
  signUpload(storageKey: string, allowedFormats: readonly string[]): SignedCategoryImageUpload;
  findImage(storageKey: string): Promise<StoredCategoryImage | null>;
}
