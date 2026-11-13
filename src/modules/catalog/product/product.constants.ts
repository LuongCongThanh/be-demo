import type { Prisma } from '#src/generated/prisma/client.js';
/** SKU chỉ gồm chữ hoa, số và dấu gạch ngang. */
export const SKU_PATTERN = /^[A-Z0-9-]+$/;

/** Include chung cho mọi chỗ trả biến thể: kèm tên size/màu để FE không phải tra thêm. */
export const VARIANT_INCLUDE = {
  size: { select: { id: true, code: true, name: true } },
  color: { select: { id: true, code: true, name: true, hex: true } },
} as const satisfies Prisma.ProductVariantInclude;
