import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { VariantStatus } from '../../generated/prisma/enums.js';
import { UpdateVariantDto } from './update-variant.dto.js';

describe('UpdateVariantDto', () => {
  it('passes validation when price is omitted (all fields optional)', async () => {
    const dto = plainToInstance(UpdateVariantDto, { status: VariantStatus.INACTIVE });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails validation when price has more than 2 decimal places', async () => {
    const dto = plainToInstance(UpdateVariantDto, { price: 100.999 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('fails validation when price is negative', async () => {
    const dto = plainToInstance(UpdateVariantDto, { price: -1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('fails validation when status is not a valid enum value', async () => {
    const dto = plainToInstance(UpdateVariantDto, { status: 'NOT_A_STATUS' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  // `price` dùng @ValidateIf thay vì @IsOptional() — cùng lý do với UpdateProductDto.name:
  // @IsOptional() do PartialType tự sinh coi `null` như "absent" và bỏ qua
  // mọi validator phía sau, cho { "price": null } lọt qua
  // validation rồi Prisma từ chối bằng PrismaClientValidationError (không map
  // được ở AllExceptionsFilter, rơi xuống 500 thay vì 400).
  it('rejects an explicit null price instead of silently skipping validation', async () => {
    const dto = plainToInstance(UpdateVariantDto, { price: null });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('passes validation with a valid price', async () => {
    const dto = plainToInstance(UpdateVariantDto, { price: 100.5 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
