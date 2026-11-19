import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CategoryTranslationClient } from '#src/modules/catalog/category/category-translation.client.js';

const LEASE_MS = 60_000;
const BATCH_SIZE = 10;

/** Each translation row is the durable queue; failed work awaits explicit retry. */
@Injectable()
export class CategoryTranslationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CategoryTranslationService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly translator: CategoryTranslationClient,
  ) {}

  onModuleInit() {
    if (!this.translator.enabled) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 5_000);
    this.timer.unref();
    void this.tick();
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  async tick(): Promise<void> {
    if (this.running || this.stopping || !this.translator.enabled) return;
    this.running = this.processBatch().catch(() => {
      this.logger.error('Category translation batch failed; pending work will be retried');
    });
    try {
      await this.running;
    } finally {
      this.running = undefined;
    }
  }

  private async processBatch(): Promise<void> {
    const at = new Date();
    const enabledLanguages =
      typeof this.prisma.categoryLanguage?.findMany === 'function'
        ? await this.prisma.categoryLanguage.findMany({
            where: { enabled: true },
            select: { locale: true, generation: true },
          })
        : [{ locale: 'en', generation: 0 }];
    const enabled = new Map(enabledLanguages.map((language) => [language.locale, language.generation]));
    if (!enabled.size) return;
    const available = { OR: [{ leaseUntil: null }, { leaseUntil: { lte: at } }] };
    const pending = await this.prisma.categoryTranslation.findMany({
      where: { locale: { in: [...enabled.keys()] }, status: 'PENDING', ...available },
      include: { category: { select: { name: true, sourceVersion: true } } },
      orderBy: [{ createdAt: 'asc' }, { categoryId: 'asc' }],
      take: BATCH_SIZE,
    });
    for (const category of pending) {
      if (this.stopping) break;
      const generation = enabled.get(category.locale);
      if (
        generation === undefined ||
        (category.enableGeneration !== undefined && category.enableGeneration !== generation)
      )
        continue;
      // A fresh lease per claim, not per batch (HTTP may take ten seconds each).
      const now = new Date();
      const lease = new Date(now.getTime() + LEASE_MS);
      const claimed = await this.prisma.categoryTranslation.updateMany({
        where: {
          categoryId: category.categoryId,
          locale: category.locale,
          sourceVersion: category.sourceVersion,
          category: { sourceVersion: category.sourceVersion },
          revision: category.revision,
          enableGeneration: generation,
          status: 'PENDING',
          OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
        },
        data: { leaseUntil: lease },
      });
      if (!claimed.count) continue;
      const where = {
        categoryId: category.categoryId,
        locale: category.locale,
        sourceVersion: category.sourceVersion,
        category: { sourceVersion: category.sourceVersion },
        revision: category.revision,
        enableGeneration: generation,
        status: 'PENDING' as const,
        leaseUntil: lease,
      };
      let name: string;
      try {
        name = await this.translator.translate(category.category.name, category.locale);
      } catch {
        await this.prisma.categoryTranslation.updateMany({
          where,
          data: { status: 'FAILED', leaseUntil: null },
        });
        this.logger.warn(
          `Category ${category.categoryId} (${category.locale}) translation failed; an administrator can retry`,
        );
        continue;
      }
      await this.prisma.categoryTranslation.updateMany({
        where,
        data: { name, status: 'TRANSLATED', leaseUntil: null },
      });
    }
  }
}
