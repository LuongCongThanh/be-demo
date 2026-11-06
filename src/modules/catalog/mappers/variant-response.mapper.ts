import type { Prisma } from '#src/generated/prisma/client.js';
import { VARIANT_INCLUDE } from '#src/modules/catalog/constants/variant-include.constant.js';
import { VariantResponseDto } from '#src/modules/catalog/dto/products/variant-response.dto.js';

export type VariantWithOptions = Prisma.ProductVariantGetPayload<{ include: typeof VARIANT_INCLUDE }>;

/**
 * `price` là BigInt trong DB (VND số nguyên) — JSON.stringify không serialize
 * được BigInt, và mọi giá VND đều nằm trong phạm vi an toàn của JS number.
 */
export function toVariantResponse({ sizeId: _s, colorId: _c, ...variant }: VariantWithOptions): VariantResponseDto {
  return { ...variant, price: Number(variant.price) };
}
