import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CategoryTranslationClient } from '#src/modules/catalog/category/category-translation.client.js';

const LEASE_MS = 60_000;
const BATCH_SIZE = 10;

/** The category row is the durable queue; failed work awaits explicit retry. */
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
    const available = { OR: [{ translationLeaseUntil: null }, { translationLeaseUntil: { lte: at } }] };
    const pending = await this.prisma.category.findMany({
      where: { translationStatus: 'PENDING', ...available },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
    });
    for (const category of pending) {
      if (this.stopping) break;
      // A fresh lease per claim, not per batch (HTTP may take ten seconds each).
      const now = new Date();
      const lease = new Date(now.getTime() + LEASE_MS);
      const claimed = await this.prisma.category.updateMany({
        where: {
          id: category.id,
          translationVersion: category.translationVersion,
          translationStatus: 'PENDING',
          OR: [{ translationLeaseUntil: null }, { translationLeaseUntil: { lte: now } }],
        },
        data: { translationLeaseUntil: lease },
      });
      if (!claimed.count) continue;
      const where = {
        id: category.id,
        translationVersion: category.translationVersion,
        translationStatus: 'PENDING' as const,
        translationLeaseUntil: lease,
      };
      let nameEn: string;
      try {
        nameEn = await this.translator.translate(category.name);
      } catch {
        await this.prisma.category.updateMany({
          where,
          data: { translationStatus: 'FAILED', translationLeaseUntil: null },
        });
        this.logger.warn(`Category ${category.id} translation failed; an administrator can retry`);
        continue;
      }
      await this.prisma.category.updateMany({
        where,
        data: { nameEn, translationStatus: 'TRANSLATED', translationLeaseUntil: null },
      });
    }
  }
}
