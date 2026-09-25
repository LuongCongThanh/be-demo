import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ProductStatus } from '@src/generated/prisma/enums.js';
import { UpdateProductDto } from '@src/modules/products/dto/update-product.dto.js';

describe('UpdateProductDto', () => {
  it('passes validation when name is omitted (all fields optional via PartialType)', async () => {
    const dto = plainToInstance(UpdateProductDto, { status: ProductStatus.INACTIVE });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // `name` là field override thủ công trong UpdateProductDto (không chỉ dựa
  // vào PartialType) để giữ đúng @Transform (trim) và @IsNotEmpty — nếu
  // không, bug empty-slug (xem ProductsService.toSlug()) sẽ quay lại ở nhánh
  // update().
  it('trims a whitespace-only name and rejects it via @IsNotEmpty()', async () => {
    const dto = plainToInstance(UpdateProductDto, { name: '   ' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('trims a valid name', async () => {
    const dto = plainToInstance(UpdateProductDto, { name: '  Wireless Headphones v2  ' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Wireless Headphones v2');
  });

  // PartialType's generated @IsOptional() treats an explicit `null` the same
  // as "absent" and skips every validator after it — a client-sent
  // { "name": null } would then reach ProductsService.update() as
  // `data.name = null`, which Prisma rejects for the NOT NULL `name` column
  // with a PrismaClientValidationError. That error is not a
  // PrismaClientKnownRequestError, so AllExceptionsFilter can't map it and it
  // falls through to an unhandled 500 instead of a clean 400. @ValidateIf on
  // the field below only skips validation when the value is `undefined`, so
  // `null` is still validated (and rejected) here, before it ever reaches the
  // service.
  it('rejects an explicit null name instead of silently skipping validation', async () => {
    const dto = plainToInstance(UpdateProductDto, { name: null });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails validation when status is not a valid enum value', async () => {
    const dto = plainToInstance(UpdateProductDto, { status: 'NOT_A_STATUS' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});
