/** Giới hạn ảnh Sản phẩm (slice B1, Q3c). Định dạng theo tên Cloudinary nhận diện từ nội dung file. */
export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const IMAGE_FORMATS = ['jpg', 'png', 'webp'] as const;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Mọi ảnh của một Sản phẩm nằm dưới tiền tố này, tên file là một UUID do API sinh. */
export const imageKeyPrefix = (productId: string) => `products/${productId}/`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Key phải đúng dạng `products/{productId}/{uuid}` do `presign` cấp. So khớp
 * chặt (không chỉ `startsWith`) để `products/{id}/../{idKhác}/…` không trỏ
 * sang file của Sản phẩm khác khi gọi kho ảnh.
 */
export function isImageKeyOf(productId: string, storageKey: string): boolean {
  const prefix = imageKeyPrefix(productId);
  return storageKey.startsWith(prefix) && UUID.test(storageKey.slice(prefix.length));
}
