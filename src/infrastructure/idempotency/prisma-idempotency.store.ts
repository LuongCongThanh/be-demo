import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaTransactionHost } from '#src/infrastructure/database/cls-transaction-runner.js';
import {
  IdempotencyStore,
  type IdempotencyJson,
  type IdempotencyRecord,
} from '#src/infrastructure/idempotency/idempotency.port.js';

@Injectable()
export class PrismaIdempotencyStore extends IdempotencyStore {
  constructor(@Inject(TransactionHost) private readonly txHost: PrismaTransactionHost) {
    super();
  }

  async find(scope: string, key: string): Promise<IdempotencyRecord | null> {
    const row = await this.txHost.tx.idempotencyKey.findFirst({ where: { scope, key } });
    if (!row) return null;
    return {
      requestHash: row.requestHash,
      responseStatus: row.responseStatus,
      response: row.response as IdempotencyJson | null,
    };
  }

  async start(scope: string, key: string, requestHash: string): Promise<void> {
    await this.txHost.tx.idempotencyKey.create({ data: { scope, key, requestHash } });
  }

  async complete(scope: string, key: string, status: number, response: IdempotencyJson): Promise<void> {
    await this.txHost.tx.idempotencyKey.update({
      where: { scope_key: { scope, key } },
      data: { responseStatus: status, response },
    });
  }
}
