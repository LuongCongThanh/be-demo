import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateProductDto } from './create-product.dto.js';

describe('CreateProductDto', () => {
  it('fails validation when name is missing', async () => {
    const dto = plainToInstance(CreateProductDto, { categoryId: '550e8400-e29b-41d4-a716-446655440000' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails validation when categoryId is missing', async () => {
    const dto = plainToInstance(CreateProductDto, { name: 'Wireless Headphones' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'categoryId')).toBe(true);
  });

  it('fails validation when categoryId is not a UUID', async () => {
    const dto = plainToInstance(CreateProductDto, { name: 'Wireless Headphones', categoryId: 'not-a-uuid' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'categoryId')).toBe(true);
  });

  // Tên chỉ gồm khoảng trắng phải bị @IsNotEmpty() chặn sau khi trim — nếu
  // không, sẽ lọt xuống service và sinh slug rỗng (xem toSlug()).
  it('trims a whitespace-only name and rejects it via @IsNotEmpty()', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: '   ',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('trims a valid name', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: '  Wireless Headphones  ',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Wireless Headphones');
  });

  it('passes validation with valid name and categoryId', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'Wireless Headphones',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes validation with an empty variants array', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'Wireless Headphones',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
      variants: [],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes validation with distinct-sku variants', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'Wireless Headphones',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
      variants: [
        { sku: 'SKU-1', price: 100000 },
        { sku: 'SKU-2', price: 120000 },
      ],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // Trùng SKU ngay trong 1 request phải bị chặn ở DTO (400) trước khi chạm
  // DB — tránh mở transaction rồi rollback chỉ vì lỗi phát hiện được tĩnh.
  it('fails validation when two variants share the same sku', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'Wireless Headphones',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
      variants: [
        { sku: 'SKU-1', price: 100000 },
        { sku: 'SKU-1', price: 120000 },
      ],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'variants')).toBe(true);
  });
});
