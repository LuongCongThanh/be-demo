import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@src/prisma/prisma.service.js';
import { OptionValuesService } from '@src/modules/option-values/option-values.service.js';

describe('OptionValuesService', () => {
  const prismaMock = {
    optionValue: { findUnique: vi.fn(), create: vi.fn(), aggregate: vi.fn(), delete: vi.fn() },
    productVariant: { count: vi.fn() },
  };
  let service: OptionValuesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.optionValue.create.mockImplementation(({ data }: { data: unknown }) => Promise.resolve(data));
    service = new OptionValuesService(prismaMock as unknown as PrismaService);
  });

  describe('create', () => {
    it('rejects a code already used by any Option Value with 409, before writing', async () => {
      prismaMock.optionValue.findUnique.mockResolvedValue({ id: 'x', code: 'BLK' });

      await expect(service.create({ type: 'SIZE', name: 'Big', code: 'BLK' })).rejects.toThrow(
        new ConflictException('Option Value code "BLK" already exists'),
      );
      expect(prismaMock.optionValue.findUnique).toHaveBeenCalledWith({ where: { code: 'BLK' } });
      expect(prismaMock.optionValue.create).not.toHaveBeenCalled();
    });

    it('appends a value without position after the last one of its type', async () => {
      prismaMock.optionValue.findUnique.mockResolvedValue(null);
      prismaMock.optionValue.aggregate.mockResolvedValue({ _max: { position: 3 } });

      const created = await service.create({ type: 'SIZE', name: 'XL', code: 'XL' });

      expect(prismaMock.optionValue.aggregate).toHaveBeenCalledWith({
        where: { type: 'SIZE' },
        _max: { position: true },
      });
      expect(created).toMatchObject({ position: 4 });
    });

    it('starts at position 0 for the first value of a type, and keeps an explicit position', async () => {
      prismaMock.optionValue.findUnique.mockResolvedValue(null);
      prismaMock.optionValue.aggregate.mockResolvedValue({ _max: { position: null } });

      await expect(service.create({ type: 'COLOR', name: 'Đen', code: 'BLK' })).resolves.toMatchObject({ position: 0 });
      await expect(service.create({ type: 'COLOR', name: 'Trắng', code: 'WHT', position: 7 })).resolves.toMatchObject({
        position: 7,
      });
    });
  });

  describe('remove', () => {
    it('rejects deleting a value that a variant uses (as color or size) with 409', async () => {
      prismaMock.productVariant.count.mockResolvedValue(2);

      await expect(service.remove('ov1')).rejects.toThrow(ConflictException);
      expect(prismaMock.productVariant.count).toHaveBeenCalledWith({
        where: { OR: [{ colorId: 'ov1' }, { sizeId: 'ov1' }] },
      });
      expect(prismaMock.optionValue.delete).not.toHaveBeenCalled();
    });

    it('deletes an unused value', async () => {
      prismaMock.productVariant.count.mockResolvedValue(0);

      await service.remove('ov1');

      expect(prismaMock.optionValue.delete).toHaveBeenCalledWith({ where: { id: 'ov1' } });
    });
  });
});
