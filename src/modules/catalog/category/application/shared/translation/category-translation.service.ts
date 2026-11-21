import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { CategoryTranslationPort } from '#src/modules/catalog/category/application/ports/translation/category-translation.port.js';
import { CATEGORY_TRANSLATION_PORT } from '#src/modules/catalog/category/application/ports/translation/category-translation.port.js';
import type { CategoryTranslationWorkerPort } from '#src/modules/catalog/category/application/ports/translation/category-translation-worker.port.js';
import { CATEGORY_TRANSLATION_WORKER_PORT } from '#src/modules/catalog/category/application/ports/translation/category-translation-worker.port.js';

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
    @Inject(CATEGORY_TRANSLATION_WORKER_PORT) private readonly worker: CategoryTranslationWorkerPort,
    @Inject(CATEGORY_TRANSLATION_PORT) private readonly translator: CategoryTranslationPort,
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
    const enabledLanguages = await this.worker.findEnabledLocales();
    const enabled = new Map(enabledLanguages.map((language) => [language.locale, language.generation]));
    if (!enabled.size) return;
    const pending = await this.worker.findPendingTranslations([...enabled.keys()], at, BATCH_SIZE);
    for (const category of pending) {
      if (this.stopping) break;
      const generation = enabled.get(category.locale);
      if (generation === undefined || category.enableGeneration !== generation) continue;
      // A fresh lease per claim, not per batch (HTTP may take ten seconds each).
      const now = new Date();
      const lease = new Date(now.getTime() + LEASE_MS);
      const claimed = await this.worker.claimTranslation(category, now, lease);
      if (!claimed) continue;
      let name: string;
      try {
        name = await this.translator.translate(category.name, category.locale);
      } catch {
        await this.worker.markTranslationFailed(category, lease);
        this.logger.warn(
          `Category ${category.categoryId} (${category.locale}) translation failed; an administrator can retry`,
        );
        continue;
      }
      await this.worker.completeTranslation(category, lease, name);
    }
  }
}
