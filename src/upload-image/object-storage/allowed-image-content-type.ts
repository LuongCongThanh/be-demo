// Danh sách mime type ảnh cho phép — dùng chung giữa DTO validate (400 sớm ở
// tầng request) và policy nhúng trong presigned POST (storage tự chối nếu
// client lách validate, gửi thẳng lên storage với Content-Type khác). Xem
// docs/superpowers/specs 2026-09-18-product-images-object-storage-design.md.
export const ALLOWED_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageContentType = (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number];

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const PRESIGNED_URL_EXPIRY_SECONDS = 15 * 60;
export const MAX_PRESIGN_BATCH_SIZE = 10;
