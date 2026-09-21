import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateCategoryDto } from './update-category.dto.js';

describe('UpdateCategoryDto', () => {
  it('passes validation when name is omitted (all fields optional via PartialType)', async () => {
    const dto = plainToInstance(UpdateCategoryDto, { description: 'Updated' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // PartialType(CreateCategoryDto) phải kế thừa cả @Transform (class-transformer)
  // lẫn @IsNotEmpty (class-validator) của field `name` — không chỉ decorator
  // validate, nếu không bug empty-slug (xem CategoriesService.toSlug()) sẽ
  // quay lại ở nhánh update().
  it('inherits the trim @Transform from CreateCategoryDto, so a whitespace-only name fails @IsNotEmpty()', async () => {
    const dto = plainToInstance(UpdateCategoryDto, { name: '   ' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('inherits trimming of a valid name', async () => {
    const dto = plainToInstance(UpdateCategoryDto, { name: '  Sneakers  ' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Sneakers');
  });
});
