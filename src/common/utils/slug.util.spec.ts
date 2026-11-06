import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { toSlugOrThrow } from '#src/common/utils/slug.util.js';

describe('toSlugOrThrow', () => {
  it('builds a lowercase ASCII slug from a Vietnamese name', () => {
    expect(toSlugOrThrow('Áo Thun Nam', 'Product')).toBe('ao-thun-nam');
  });

  it('rejects a name that produces an empty slug', () => {
    expect(() => toSlugOrThrow('!!!', 'Category')).toThrow(BadRequestException);
  });
});
