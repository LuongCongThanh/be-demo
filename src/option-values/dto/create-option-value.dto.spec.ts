import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateOptionValueDto } from '@src/option-values/dto/create-option-value.dto.js';

async function errorsFor(body: Record<string, unknown>) {
  return validate(plainToInstance(CreateOptionValueDto, body));
}

describe('CreateOptionValueDto', () => {
  it.each(['BLK', 'M', 'XL2', 'ABCDEFGHIJ'])('accepts code %s', async (code) => {
    expect(await errorsFor({ type: 'COLOR', name: 'x', code })).toHaveLength(0);
  });

  // Chữ thường không được tự chuyển hoa — FE phải thấy đúng giá trị lưu.
  it.each(['blk', 'BL-K', 'BL K', '', 'ABCDEFGHIJK', 'Đ'])('rejects code "%s"', async (code) => {
    const errors = await errorsFor({ type: 'COLOR', name: 'x', code });
    expect(errors.map((e) => e.property)).toContain('code');
  });

  it('accepts an optional non-negative integer position', async () => {
    expect(await errorsFor({ type: 'SIZE', name: 'M', code: 'M', position: 2 })).toHaveLength(0);
    const errors = await errorsFor({ type: 'SIZE', name: 'M', code: 'M', position: -1 });
    expect(errors.map((e) => e.property)).toContain('position');
  });
});
