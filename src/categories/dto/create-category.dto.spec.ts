import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCategoryDto } from './create-category.dto.js';

describe('CreateCategoryDto', () => {
  it('fails validation when name is missing', async () => {
    const dto = plainToInstance(CreateCategoryDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails validation when name exceeds 150 characters', async () => {
    const dto = plainToInstance(CreateCategoryDto, { name: 'a'.repeat(151) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('passes validation with only name (description optional)', async () => {
    const dto = plainToInstance(CreateCategoryDto, { name: 'Shoes' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes validation with name and description', async () => {
    const dto = plainToInstance(CreateCategoryDto, {
      name: 'Shoes',
      description: 'Footwear',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
