import type { Prisma } from '#src/generated/prisma/client.js';
import { VariantResponseDto } from '#src/products/dto/variant-response.dto.js';

/** Include chung cho mọi chỗ trả biến thể: kèm tên size/màu để FE không phải tra thêm. */
export const VARIANT_INCLUDE = {
  size: { select: { id: true, code: true, name: true } },
  color: { select: { id: true, code: true, name: true, hex: true } },
} as const satisfies Prisma.ProductVariantInclude;

export type VariantWithOptions = Prisma.ProductVariantGetPayload<{ include: typeof VARIANT_INCLUDE }>;

/**
 * `price` là BigInt trong DB (VND số nguyên) — JSON.stringify không serialize
 * được BigInt, và mọi giá VND đều nằm trong phạm vi an toàn của JS number.
 */
export function toVariantResponse({ sizeId: _s, colorId: _c, ...variant }: VariantWithOptions): VariantResponseDto {
  return { ...variant, price: Number(variant.price) };
}
