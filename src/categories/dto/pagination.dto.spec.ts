import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PaginationDto } from './pagination.dto.js';

describe('PaginationDto', () => {
  it('defaults page to 1 and limit to 20 when omitted', () => {
    const dto = plainToInstance(PaginationDto, {});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('coerces string query values to numbers', () => {
    const dto = plainToInstance(PaginationDto, { page: '2', limit: '50' });
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });

  it('fails validation when limit exceeds 100', async () => {
    const dto = plainToInstance(PaginationDto, { limit: '1000000' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('fails validation when page is less than 1', async () => {
    const dto = plainToInstance(PaginationDto, { page: '0' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });
});
