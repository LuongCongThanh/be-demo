import { describe, expect, it } from 'vitest';
import {
  calculateShippingFee,
  calculateVoucherDiscount,
  distributeDiscount,
  fingerprint,
} from '#src/modules/checkout/domain/checkout-pricing.js';

describe('checkout pricing', () => {
  it('calculates integer voucher discounts with a cap and fixed amount', () => {
    expect(calculateVoucherDiscount(1001, { type: 'PERCENT', value: 10, maxDiscount: 50 })).toBe(50);
    expect(calculateVoucherDiscount(100, { type: 'FIXED', value: 500, maxDiscount: null })).toBe(100);
  });

  it('keeps percentage discount arithmetic exact near the safe-integer limit', () => {
    const subtotal = Number.MAX_SAFE_INTEGER;

    expect(calculateVoucherDiscount(subtotal, { type: 'PERCENT', value: 99, maxDiscount: null })).toBe(
      Number((BigInt(subtotal) * 99n) / 100n),
    );
  });

  it('waives fallback shipping after the voucher discount reaches the threshold', () => {
    expect(calculateShippingFee(520_000, 20_000)).toBe(0);
    expect(calculateShippingFee(519_999, 20_000)).toBe(30_000);
  });

  it('allocates rounding remainder without exceeding any line total', () => {
    expect(distributeDiscount([{ lineTotal: 1 }, { lineTotal: 1 }, { lineTotal: 1 }], 2)).toEqual([0, 1, 1]);
  });

  it('distributes discounts exactly when the combined lines exceed safe integer precision', () => {
    const lineTotal = Number.MAX_SAFE_INTEGER;

    expect(distributeDiscount([{ lineTotal }, { lineTotal }], lineTotal)).toEqual([
      Math.floor(lineTotal / 2),
      Math.ceil(lineTotal / 2),
    ]);
  });

  it('fingerprints object keys independent of insertion order but preserves array order', () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
    expect(fingerprint([1, 2])).not.toBe(fingerprint([2, 1]));
  });
});
