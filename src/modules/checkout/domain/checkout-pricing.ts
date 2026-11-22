import { createHash } from 'node:crypto';

export const CHECKOUT_QUOTE_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_SHIPPING_FEE = 30_000;
export const DEFAULT_FREE_SHIPPING_THRESHOLD = 500_000;
export const DEFAULT_COD_LIMIT = 10_000_000;

export interface VoucherTerms {
  type: 'PERCENT' | 'FIXED';
  value: number;
  maxDiscount: number | null;
}

export function calculateVoucherDiscount(subtotal: number, voucher: VoucherTerms | null): number {
  if (!voucher) return 0;
  if (voucher.type === 'FIXED') return Math.min(voucher.value, subtotal);
  const amount = Number((BigInt(subtotal) * BigInt(voucher.value)) / 100n);
  return Math.min(amount, voucher.maxDiscount ?? amount, subtotal);
}

export function calculateShippingFee(
  subtotal: number,
  discount: number,
  fallbackFee = DEFAULT_SHIPPING_FEE,
  freeShippingThreshold = DEFAULT_FREE_SHIPPING_THRESHOLD,
): number {
  return subtotal - discount >= freeShippingThreshold ? 0 : fallbackFee;
}

export function distributeDiscount(lines: { lineTotal: number }[], discount: number): number[] {
  if (lines.length === 0 || discount === 0) return lines.map(() => 0);

  const subtotal = lines.reduce((sum, line) => sum + BigInt(line.lineTotal), 0n);
  const totalDiscount = BigInt(discount);
  const shares = lines.map((line) => Number((totalDiscount * BigInt(line.lineTotal)) / subtotal));
  let remainder = totalDiscount - shares.reduce((sum, share) => sum + BigInt(share), 0n);

  for (let index = shares.length - 1; index >= 0 && remainder > 0; index -= 1) {
    const additional = [remainder, BigInt(lines[index].lineTotal - shares[index])].reduce((smaller, value) =>
      smaller < value ? smaller : value,
    );
    shares[index] += Number(additional);
    remainder -= additional;
  }

  return shares;
}

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
