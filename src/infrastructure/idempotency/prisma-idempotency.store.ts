import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Prisma } from '#src/generated/prisma/client.js';
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
    return { requestHash: row.requestHash, responseStatus: row.responseStatus, response: row.response };
  }

  async start(scope: string, key: string, requestHash: string): Promise<boolean> {
    // skipDuplicates = INSERT ... ON CONFLICT DO NOTHING: trùng khoá không ném
    // P2002 nên giao dịch đang mở vẫn dùng tiếp được.
    const { count } = await this.txHost.tx.idempotencyKey.createMany({
      data: [{ scope, key, requestHash }],
      skipDuplicates: true,
    });
    return count === 1;
  }

  async complete(scope: string, key: string, status: number, response: IdempotencyJson): Promise<void> {
    const { count } = await this.txHost.tx.idempotencyKey.updateMany({
      where: { scope, key },
      data: { responseStatus: status, response: response === null ? Prisma.JsonNull : response },
    });
    if (count === 0) {
      throw new Error(`Idempotency key not started: scope="${scope}" key="${key}" (call start() first)`);
    }
  }
}
