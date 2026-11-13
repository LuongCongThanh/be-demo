/** Giới hạn ảnh Sản phẩm (slice B1, Q3c). Định dạng theo tên Cloudinary nhận diện từ nội dung file. */
export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const IMAGE_FORMATS = ['jpg', 'png', 'webp'] as const;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Mọi ảnh của một Sản phẩm nằm dưới tiền tố này; bước gắn ảnh từ chối key ngoài tiền tố. */
export const imageKeyPrefix = (productId: string) => `products/${productId}/`;
