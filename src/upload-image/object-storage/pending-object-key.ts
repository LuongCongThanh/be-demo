import { randomUUID } from 'node:crypto';
import { IMAGE_EXTENSION_BY_CONTENT_TYPE } from '../upload-image.constants.js';
import type { AllowedImageContentType } from '../upload-image.constants.js';

// Một chỗ duy nhất định nghĩa tên object của Pending Upload: `<uuid>.<ext>`,
// ext suy từ content type (không lấy từ filename client gửi). Adapter storage
// dùng để sinh key, UploadImageService dùng để kiểm key client gửi lên.
export function pendingObjectKey(keyPrefix: string, contentType: AllowedImageContentType): string {
  return `${keyPrefix}${randomUUID()}.${IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType]}`;
}

const PENDING_OBJECT_NAME = new RegExp(
  String.raw`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(${Object.values(IMAGE_EXTENSION_BY_CONTENT_TYPE).join('|')})$`,
);

/** `name` là phần sau prefix — đúng format pendingObjectKey() sinh ra. */
export function isPendingObjectName(name: string): boolean {
  return PENDING_OBJECT_NAME.test(name);
}
