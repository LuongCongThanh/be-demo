import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ProductStatus } from '@src/generated/prisma/enums.js';
import { ListProductsQueryDto } from './list-products-query.dto.js';

describe('ListProductsQueryDto', () => {
  it('defaults page to 1 and limit to 20 when omitted', () => {
    const dto = plainToInstance(ListProductsQueryDto, {});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('passes validation when categoryId and status are omitted', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails validation when categoryId is not a UUID', async () => {
    const dto = plainToInstance(ListProductsQueryDto, { categoryId: 'not-a-uuid' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'categoryId')).toBe(true);
  });

  it('fails validation when status is not a valid enum value', async () => {
    const dto = plainToInstance(ListProductsQueryDto, { status: 'NOT_A_STATUS' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('passes validation with a valid categoryId and status', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
      status: ProductStatus.ACTIVE,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
