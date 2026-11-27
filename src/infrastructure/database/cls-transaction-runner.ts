import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import type { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { TransactionRunner, type TransactionOptions } from '#src/infrastructure/database/transaction-runner.port.js';

export type PrismaTransactionHost = TransactionHost<TransactionalAdapterPrisma<PrismaService>>;

/** Adapter `TransactionRunner` bằng `@nestjs-cls/transactional` (propagation mặc định Required). */
@Injectable()
export class ClsTransactionRunner extends TransactionRunner {
  constructor(@Inject(TransactionHost) private readonly txHost: PrismaTransactionHost) {
    super();
  }

  run<T>(work: () => Promise<T>, opts?: TransactionOptions): Promise<T> {
    return opts ? this.txHost.withTransaction(opts, work) : this.txHost.withTransaction(work);
  }
}
