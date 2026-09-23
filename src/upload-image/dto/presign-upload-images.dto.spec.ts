import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PresignUploadImagesDto } from './presign-upload-images.dto.js';

function filesOf(count: number) {
  return Array.from({ length: count }, (_, i) => ({ filename: `photo-${i}.jpg`, contentType: 'image/jpeg' }));
}

describe('PresignUploadImagesDto', () => {
  it('fails validation when files is empty', async () => {
    const dto = plainToInstance(PresignUploadImagesDto, { purpose: 'PRODUCT_IMAGE', files: [] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'files')).toBe(true);
  });

  it('passes validation with 10 files (the max allowed)', async () => {
    const dto = plainToInstance(PresignUploadImagesDto, { purpose: 'PRODUCT_IMAGE', files: filesOf(10) });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails validation with 11 files (over the max)', async () => {
    const dto = plainToInstance(PresignUploadImagesDto, { purpose: 'PRODUCT_IMAGE', files: filesOf(11) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'files')).toBe(true);
  });

  it('fails validation when a file has an unsupported content type', async () => {
    const dto = plainToInstance(PresignUploadImagesDto, {
      purpose: 'PRODUCT_IMAGE',
      files: [{ filename: 'a.gif', contentType: 'image/gif' }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails validation when purpose is missing or unknown', async () => {
    for (const purpose of [undefined, 'USER_AVATAR']) {
      const dto = plainToInstance(PresignUploadImagesDto, { purpose, files: filesOf(1) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'purpose')).toBe(true);
    }
  });
});
