import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { CategoriesService } from './categories.service.js';

describe('CategoriesService', () => {
  let service: CategoriesService;
  const prismaMock = {
    category: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    product: {
      count: vi.fn(),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(CategoriesService);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('generates a slug from name and creates the category', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);
      prismaMock.category.create.mockResolvedValue({ id: '1', name: 'Shoes', slug: 'shoes', description: null });

      const result = await service.create({ name: 'Shoes' });

      expect(prismaMock.category.findUnique).toHaveBeenCalledWith({ where: { slug: 'shoes' } });
      expect(prismaMock.category.create).toHaveBeenCalledWith({ data: { name: 'Shoes', slug: 'shoes' } });
      expect(result.slug).toBe('shoes');
    });

    it('throws ConflictException when the generated slug already exists', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'existing', name: 'Shoes', slug: 'shoes' });

      await expect(service.create({ name: 'Shoes' })).rejects.toThrow(ConflictException);
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns paginated data with meta', async () => {
      prismaMock.category.findMany.mockResolvedValue([{ id: '1', name: 'Shoes', slug: 'shoes' }]);
      prismaMock.category.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(prismaMock.category.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      expect(result).toEqual({
        data: [{ id: '1', name: 'Shoes', slug: 'shoes' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it('computes the correct skip for page > 1', async () => {
      prismaMock.category.findMany.mockResolvedValue([]);
      prismaMock.category.count.mockResolvedValue(45);

      await service.findAll({ page: 3, limit: 20 });

      expect(prismaMock.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
    });
  });

  describe('findOne', () => {
    it('returns the category when found', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: '1', name: 'Shoes', slug: 'shoes' });
      const result = await service.findOne('1');
      expect(result).toEqual({ id: '1', name: 'Shoes', slug: 'shoes' });
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('regenerates the slug when name changes', async () => {
      prismaMock.category.findUnique
        .mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' }) // findOne() pre-fetch
        .mockResolvedValueOnce(null); // slug uniqueness check
      prismaMock.category.update.mockResolvedValue({ id: '1', name: 'Sneakers', slug: 'sneakers' });

      const result = await service.update('1', { name: 'Sneakers' });

      expect(prismaMock.category.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'Sneakers', slug: 'sneakers' },
      });
      expect(result.slug).toBe('sneakers');
    });

    it('throws ConflictException when the new name collides with a different category', async () => {
      prismaMock.category.findUnique
        .mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' })
        .mockResolvedValueOnce({ id: '2', name: 'Sneakers', slug: 'sneakers' });

      await expect(service.update('1', { name: 'Sneakers' })).rejects.toThrow(ConflictException);
    });

    it('does not touch the slug when name is not part of the update', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' });
      prismaMock.category.update.mockResolvedValue({ id: '1', name: 'Shoes', slug: 'shoes', description: 'Updated' });

      await service.update('1', { description: 'Updated' });

      expect(prismaMock.category.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { description: 'Updated' },
      });
    });

    it('throws NotFoundException when the category does not exist', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce(null);
      await expect(service.update('missing-id', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the category when no products reference it', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' });
      prismaMock.product.count.mockResolvedValue(0);
      prismaMock.category.delete.mockResolvedValue(undefined);

      await service.remove('1');

      expect(prismaMock.product.count).toHaveBeenCalledWith({ where: { categoryId: '1' } });
      expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('throws ConflictException when products still reference the category', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce({ id: '1', name: 'Shoes', slug: 'shoes' });
      prismaMock.product.count.mockResolvedValue(3);

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
      expect(prismaMock.category.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the category does not exist', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce(null);
      await expect(service.remove('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
