import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PresignImagesDto } from './presign-images.dto.js';

function filesOf(count: number) {
  return Array.from({ length: count }, (_, i) => ({ filename: `photo-${i}.jpg`, contentType: 'image/jpeg' }));
}

describe('PresignImagesDto', () => {
  it('fails validation when files is empty', async () => {
    const dto = plainToInstance(PresignImagesDto, { files: [] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'files')).toBe(true);
  });

  it('passes validation with 10 files (the max allowed)', async () => {
    const dto = plainToInstance(PresignImagesDto, { files: filesOf(10) });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails validation with 11 files (over the max)', async () => {
    const dto = plainToInstance(PresignImagesDto, { files: filesOf(11) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'files')).toBe(true);
  });

  it('fails validation when a file has an unsupported content type', async () => {
    const dto = plainToInstance(PresignImagesDto, {
      files: [{ filename: 'a.gif', contentType: 'image/gif' }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
