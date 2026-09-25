import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateProductDto } from '@src/modules/products/dto/create-product.dto.js';

// Phần bắt buộc ngoài field đang kiểm tra: ≥1 variant, 1–5 ảnh.
const REQUIRED_NESTED = { variants: [{ price: 1 }], images: [{ key: 'tmp/product-image/a.jpg' }] };

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
      ...REQUIRED_NESTED,
      name: '  Wireless Headphones  ',
      code: 'WH01',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Wireless Headphones');
  });

  it('passes validation with valid name, code and categoryId', async () => {
    const dto = plainToInstance(CreateProductDto, {
      ...REQUIRED_NESTED,
      name: 'Wireless Headphones',
      code: 'WH01',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it.each(['TSB001', 'AB', 'ABCDEFGHIJ1234567890'])('accepts Product Code %s', async (code) => {
    const dto = plainToInstance(CreateProductDto, {
      ...REQUIRED_NESTED,
      name: 'x',
      code,
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  // Không tự viết hoa — FE phải thấy đúng giá trị sẽ nằm trong SKU.
  it.each(['tsb001', 'A', 'TSB-001', 'TSB 001', 'ABCDEFGHIJ12345678901', undefined])(
    'rejects Product Code %s',
    async (code) => {
      const dto = plainToInstance(CreateProductDto, {
        name: 'x',
        code,
        categoryId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect((await validate(dto)).map((e) => e.property)).toContain('code');
    },
  );

  it.each([
    ['no variants', { images: REQUIRED_NESTED.images }, 'variants'],
    ['empty variants', { ...REQUIRED_NESTED, variants: [] }, 'variants'],
    ['no images', { variants: REQUIRED_NESTED.variants }, 'images'],
    ['6 images', { ...REQUIRED_NESTED, images: Array.from({ length: 6 }, (_, i) => ({ key: `k${i}` })) }, 'images'],
  ])('rejects %s', async (_label, nested, property) => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'x',
      code: 'AB',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
      ...nested,
    });
    expect((await validate(dto)).map((e) => e.property)).toContain(property);
  });
});
