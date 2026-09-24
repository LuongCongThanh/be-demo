import { describe, expect, it } from 'vitest';
import { composeSku } from '@src/products/sku.util.js';

describe('composeSku', () => {
  it('joins Product Code, color code and size code with dashes', () => {
    expect(composeSku('TSB001', 'BLK', 'M')).toBe('TSB001-BLK-M');
  });

  it('omits a missing color or size segment', () => {
    expect(composeSku('TSB001', 'BLK', undefined)).toBe('TSB001-BLK');
    expect(composeSku('TSB001', undefined, 'XL')).toBe('TSB001-XL');
  });

  it('is just the Product Code for a product without variation', () => {
    expect(composeSku('MUG01', undefined, undefined)).toBe('MUG01');
  });
});
