import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { isCategoryLocale } from '#src/modules/catalog/category/category-locale.js';

@Injectable()
export class CategoryLanguageService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(enabledOnly = false) {
    return this.prisma.categoryLanguage.findMany({
      where: enabledOnly ? { enabled: true } : undefined,
      orderBy: [{ locale: 'asc' }],
    });
  }

  async setEnabled(locale: string, enabled: boolean) {
    if (!isCategoryLocale(locale)) {
      throw new BadRequestException(`Unsupported category locale "${locale}"`);
    }
    if (locale === 'vi') {
      if (!enabled) throw new BadRequestException('The Vietnamese source locale cannot be disabled');
      enabled = true;
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.categoryLanguage.findUnique({ where: { locale } });
      if (!current) throw new BadRequestException(`Category locale "${locale}" is not configured`);
      if (enabled === current.enabled) return current;

      const generation = current.generation + 1;
      const language = await tx.categoryLanguage.update({
        where: { locale },
        data: { enabled, generation },
      });
      if (!enabled) {
        await tx.categoryTranslation.updateMany({
          where: { locale },
          data: { enableGeneration: generation, leaseUntil: null },
        });
      } else {
        const categories = await tx.category.findMany({ select: { id: true, sourceVersion: true } });
        await Promise.all(
          categories.map(async (category) => {
            const existing = await tx.categoryTranslation.findUnique({
              where: { categoryId_locale: { categoryId: category.id, locale } },
            });
            if (existing?.status === 'MANUAL' || existing?.status === 'REVIEW') {
              await tx.categoryTranslation.update({
                where: { categoryId_locale: { categoryId: category.id, locale } },
                data: { sourceVersion: category.sourceVersion, enableGeneration: generation, leaseUntil: null },
              });
              return;
            }
            return tx.categoryTranslation.upsert({
              where: { categoryId_locale: { categoryId: category.id, locale } },
              update: {
                name: existing?.name ?? null,
                status: 'PENDING',
                revision: { increment: 1 },
                sourceVersion: category.sourceVersion,
                enableGeneration: generation,
                leaseUntil: null,
              },
              create: {
                categoryId: category.id,
                locale,
                sourceVersion: category.sourceVersion,
                status: 'PENDING',
                enableGeneration: generation,
              },
            });
          }),
        );
      }
      return language;
    });
  }

  async assertEnabled(locale: string | undefined) {
    const resolved = locale ?? 'vi';
    if (!isCategoryLocale(resolved)) throw new BadRequestException(`Unsupported category locale "${resolved}"`);
    const language = await this.prisma.categoryLanguage.findUnique({
      where: { locale: resolved },
      select: { enabled: true },
    });
    if (!language?.enabled) throw new BadRequestException(`Category locale "${resolved}" is not enabled`);
    return resolved;
  }
}
