import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateVariantDto } from './create-variant.dto.js';

describe('CreateVariantDto', () => {
  it('fails validation when colorId or sizeId is not a UUID', async () => {
    const errors = await validate(plainToInstance(CreateVariantDto, { colorId: 'black', sizeId: 'M', price: 1 }));
    expect(errors.map((e) => e.property).sort((a, b) => a.localeCompare(b))).toEqual(['colorId', 'sizeId']);
  });

  it('fails validation when price is missing', async () => {
    const dto = plainToInstance(CreateVariantDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('fails validation when price is negative', async () => {
    const dto = plainToInstance(CreateVariantDto, { price: -1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('fails validation when price has more than 2 decimal places', async () => {
    const dto = plainToInstance(CreateVariantDto, { price: 100.999 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('passes validation with price rounded to 2 decimal places', async () => {
    const dto = plainToInstance(CreateVariantDto, { price: 100.5 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes validation with only price (color/size optional)', async () => {
    const dto = plainToInstance(CreateVariantDto, { price: 100000 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
