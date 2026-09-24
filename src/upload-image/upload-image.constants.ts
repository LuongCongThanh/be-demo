// Danh sách mime type ảnh cho phép — dùng chung giữa DTO validate (400 sớm ở
// tầng request) và policy nhúng trong presigned POST (storage tự chối nếu
// client lách validate, gửi thẳng lên storage với Content-Type khác). Xem
// docs/specs/03-products.md và docs/adr/0010.
export const ALLOWED_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageContentType = (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number];

// Đuôi file của key suy ra từ content type (server quyết định), KHÔNG lấy từ
// `filename` client gửi — filename là input tuỳ ý, có thể chứa `/` hoặc `..`
// làm key thoát khỏi `<uuid>.<ext>` và đụng key của ảnh khác khi promote.
export const IMAGE_EXTENSION_BY_CONTENT_TYPE: Record<AllowedImageContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const PRESIGNED_URL_EXPIRY_SECONDS = 15 * 60;
