import { Global, Module } from '@nestjs/common';
import { ClsTransactionRunner } from '#src/infrastructure/database/cls-transaction-runner.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { TransactionRunner } from '#src/infrastructure/database/transaction-runner.port.js';

@Global()
@Module({
  providers: [PrismaService, ClsTransactionRunner, { provide: TransactionRunner, useExisting: ClsTransactionRunner }],
  exports: [PrismaService, TransactionRunner],
})
export class PrismaModule {}
