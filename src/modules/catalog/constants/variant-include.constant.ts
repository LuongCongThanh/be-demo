import type { Prisma } from '#src/generated/prisma/client.js';

/** Include chung cho mọi chỗ trả biến thể: kèm tên size/màu để FE không phải tra thêm. */
export const VARIANT_INCLUDE = {
  size: { select: { id: true, code: true, name: true } },
  color: { select: { id: true, code: true, name: true, hex: true } },
} as const satisfies Prisma.ProductVariantInclude;
