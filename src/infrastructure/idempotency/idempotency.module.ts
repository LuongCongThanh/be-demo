import { Module } from '@nestjs/common';
import { IdempotencyStore } from '#src/infrastructure/idempotency/idempotency.port.js';
import { PrismaIdempotencyStore } from '#src/infrastructure/idempotency/prisma-idempotency.store.js';

@Module({
  providers: [PrismaIdempotencyStore, { provide: IdempotencyStore, useExisting: PrismaIdempotencyStore }],
  exports: [IdempotencyStore],
})
export class IdempotencyModule {}
